import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Oturum belirteçleri iOS Keychain / Android Keystore'da (expo-secure-store) saklanır.
 * SecureStore değer başına ~2 KB sınırı koyduğu için JWT içeren oturum JSON'u parçalara bölünür.
 * Web'de (yalnızca geliştirme/test) tarayıcı depolaması kullanılır.
 */
const CHUNK = 1500;
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const countKey = (k: string) => `${k}.n`;
const partKey = (k: string, i: number) => `${k}.${i}`;

async function removeParts(key: string) {
  const n = Number(await SecureStore.getItemAsync(countKey(key), OPTS));
  await SecureStore.deleteItemAsync(countKey(key), OPTS);
  for (let i = 0; i < (Number.isFinite(n) ? n : 0); i++) await SecureStore.deleteItemAsync(partKey(key, i), OPTS);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    const n = Number(await SecureStore.getItemAsync(countKey(key), OPTS));
    if (!Number.isInteger(n) || n < 1) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(partKey(key, i), OPTS);
      if (part === null) return null; // yarım yazılmış kayıt: oturum yok say, kullanıcı yeniden giriş yapar
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    // Önce parçalar, en son sayaç yazılır: yazma yarıda kesilirse eski/boş kayıt okunur, bozuk kayıt değil
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(partKey(key, i), parts[i], OPTS);
    await SecureStore.setItemAsync(countKey(key), String(parts.length), OPTS);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    await removeParts(key);
  },
};
