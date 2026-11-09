/**
 * expo-notifications, iOS derlemesine uzaktan bildirim (push) yetkisi `aps-environment` ekler.
 * Monibo yalnızca yerel bildirim (hatırlatıcı) kullanır; push sunucusu yoktur. Kullanılmayan yetki
 * App Store incelemesinde ve sertifika eşleşmesinde gereksiz soru doğurduğu için derlemeden çıkarılır.
 * Yerel bildirimler bu yetkiye ihtiyaç duymaz.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
