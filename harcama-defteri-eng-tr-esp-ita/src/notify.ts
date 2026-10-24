import * as Notifications from 'expo-notifications';
import { fmtMoney } from './currency';
import { t } from './i18n';
import { Expense, Settings, Sub, subStatus } from './lib';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PermState = 'granted' | 'undetermined' | 'denied';
export type PermInfo = { state: PermState; canAskAgain: boolean };

/** Bildirim izninin gerçek durumu. 'denied': reddedildi (canAskAgain false ise yalnızca sistem ayarlarından açılır). Okunamazsa (web vb.) 'denied'. */
export async function permissionInfo(): Promise<PermInfo> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return { state: 'granted', canAskAgain: true };
    if (p.status === Notifications.PermissionStatus.UNDETERMINED) return { state: 'undetermined', canAskAgain: true };
    return { state: 'denied', canAskAgain: p.canAskAgain };
  } catch {
    return { state: 'denied', canAskAgain: false };
  }
}
export async function permissionState(): Promise<PermState> {
  return (await permissionInfo()).state;
}

export async function ensurePermission() {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false; // kalıcı reddedilmiş: sistem istemi artık çıkmaz
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false; // web gibi desteklenmeyen ortamlar
  }
}

/**
 * (Ödeme bildirimi tutarı, aboneliğin gerçekten ödendiği para biriminde yazılır; ana para birimine çevrilmez.)
 * Bütün yerel bildirimleri baştan kurar: her akşam hatırlatma ve
 * her aboneliğin bir sonraki ödeme günü sabahı 10:00'da uyarı.
 */
export async function reschedule(settings: Settings, subs: Sub[], items: Expense[]) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.remind && !(settings.subRemind && subs.length)) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return; // izin yoksa kurulmaz; izin App'te bağlama göre (abonelik kaydında / anahtar açılınca) istenir

    if (settings.remind) {
      await Notifications.scheduleNotificationAsync({
        content: { title: t('app.name'), body: t('notif.daily') },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: settings.remindHour, minute: 0 },
      });
    }
    if (settings.subRemind) {
      const now = Date.now();
      for (const s of subs.slice(0, 50)) {
        const st = subStatus(s, items);
        const target = st.state === 'upcoming' ? st.due : st.state === 'pending' ? null : st.next;
        if (!target) continue;
        const when = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 10, 0);
        if (when.getTime() <= now) continue;
        await Notifications.scheduleNotificationAsync({
          content: { title: t('notif.subTitle', { name: s.name }), body: t('notif.subBody', { amount: fmtMoney(s.amount, s.cur ?? 'TRY') }) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
        });
      }
    }
  } catch {
    // Bildirim kurulamazsa uygulamanın geri kalanı etkilenmesin.
  }
}

export async function cancelAllReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
