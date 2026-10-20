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

export async function ensurePermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
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
    if (!perm.granted) return;

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
