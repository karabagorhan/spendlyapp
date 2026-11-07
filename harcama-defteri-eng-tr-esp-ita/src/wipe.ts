import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelAllReminders } from './notify';
import { KEY } from './store';

/** Hesap silinirken "cihazdaki verileri de sil" seçildiyse: harcama verisi ve zamanlanmış bildirimler kaldırılır. */
export async function wipeLocalData() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
  await cancelAllReminders();
}
