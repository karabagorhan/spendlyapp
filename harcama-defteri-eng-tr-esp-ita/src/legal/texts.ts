import { Lang } from '../i18n';
import { LEGAL } from './config';

/**
 * Uygulama içi yasal metinler (TASLAK). Yayından önce bir hukukçu tarafından gözden geçirilmeli ve web'de
 * `LEGAL.privacyUrl` / `LEGAL.termsUrl` adreslerinde aynen yayınlanmalıdır.
 *
 * Metinler uygulamanın BU SÜRÜMDEKİ gerçek davranışını anlatır; özellik eklenince (bulut eşitleme, çökme raporu,
 * analitik, ödemeler) ilgili madde güncellenmeli ve `LEGAL_VERSION` artırılmalıdır.
 * Şu an yalnızca Türkçe ve İngilizce vardır; diğer diller İngilizce metni gösterir.
 */
export type LegalKind = 'privacy' | 'terms';
export type Section = { title: string; body: string[] };
export type LegalDoc = { title: string; sections: Section[] };

const fill = (s: string) =>
  s.replace(/\{controller\}/g, LEGAL.controllerName).replace(/\{email\}/g, LEGAL.contactEmail).replace(/\{region\}/g, LEGAL.dataRegion).replace(/\{law\}/g, LEGAL.governingLaw);

const tr: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Gizlilik Politikası',
    sections: [
      { title: 'Kimiz', body: ['Bu uygulamayı {controller} ("biz") sunar. Kişisel verilerinizle ilgili tüm sorularınız için: {email}.'] },
      { title: 'Verileriniz nerede tutulur', body: [
        'Harcama, bütçe, abonelik ve ayar kayıtlarınız yalnızca cihazınızda saklanır. Bu sürümde bu kayıtlar sunucularımıza gönderilmez.',
        'Hesap açmadan kullanabilirsiniz; bu durumda bizimle paylaşılan hiçbir kişisel veri yoktur.',
      ] },
      { title: 'Hesap açarsanız topladıklarımız', body: [
        'E-posta adresiniz, (verirseniz) adınız, giriş yönteminiz (e-posta, Apple ya da Google), hesabın oluşturulma ve son giriş zamanı ile bu politikayı ve koşulları kabul ettiğiniz sürüm ve zaman.',
        'E-posta ile kayıtta parolanız yalnızca tek yönlü şifrelenmiş (hash) olarak saklanır; biz göremeyiz.',
        'Apple ile girişte Apple, e-postanızı gizleme seçeneğini sunar; bu seçeneği kullanırsanız bize yalnızca Apple\'ın ilettiği takma adres ulaşır.',
      ] },
      { title: 'Neden kullanıyoruz', body: [
        'Hesabınızı oluşturmak ve oturumunuzu doğrulamak, e-posta doğrulama ve şifre sıfırlama iletileri göndermek, kötüye kullanımı önlemek ve yasal yükümlülükleri yerine getirmek için. Pazarlama amaçlı kullanmıyoruz ve üçüncü taraflara satmıyoruz.',
      ] },
      { title: 'Hizmet sağlayıcılar', body: [
        'Hesap altyapısı için Supabase kullanırız; hesap verileriniz {region} bölgesinde barındırılır. Apple ve Google ile girişte ilgili şirketin kimlik doğrulama hizmeti devreye girer.',
        'Döviz kurlarını göstermek için uygulama Frankfurter (frankfurter.dev) ve ExchangeRate-API hizmetlerinden kur bilgisi çeker. Bu isteklerde harcama verileriniz gönderilmez; ancak her internet isteğinde olduğu gibi IP adresiniz bu hizmetler tarafından görülür.',
        'Uygulama güncellemelerini indirmek için Expo\'nun güncelleme hizmeti (EAS Update) kullanılır; bu hizmet, doğru güncellemeyi seçebilmek için uygulama sürümü ve platform gibi teknik bilgileri ve IP adresinizi işler.',
        'Bu sürümde reklam, izleme ya da analiz aracı kullanmıyoruz.',
      ] },
      { title: 'Saklama ve silme', body: [
        'Hesap verilerinizi hesabınız açık olduğu sürece saklarız. Ayarlar > Hesap > Hesabı sil ile hesabınızı ve sunucudaki tüm verilerinizi anında ve kalıcı olarak silebilirsiniz; Apple ile giriş yaptıysanız Apple erişim izniniz de iptal edilir. Sağlayıcıların teknik yedeklerinde sınırlı bir süre daha kalabilir.',
        'Cihazınızdaki harcama verileri uygulamayı silerek ya da hesabı silerken "cihazdaki verileri de sil" seçeneğiyle kaldırılır.',
      ] },
      { title: 'Haklarınız', body: [
        'Yürürlükteki mevzuat (KVKK madde 11, AB/AEA kullanıcıları için GDPR) uyarınca verilerinize erişme, düzeltme, silme, işlemeyi sınırlama, itiraz etme ve taşıma haklarına sahipsiniz. Taleplerinizi {email} adresine iletebilirsiniz. Ayrıca yetkili veri koruma otoritesine şikâyet hakkınız saklıdır.',
      ] },
      { title: 'Çocuklar', body: ['Uygulama 16 yaşından küçüklere yönelik değildir; bilerek bu yaştaki çocuklardan veri toplamayız.'] },
      { title: 'Değişiklikler', body: ['Bu politika değişirse yeni sürümü uygulamada yayınlar, önemli değişikliklerde sizi ayrıca bilgilendiririz. Sürüm tarihi: ' + '2026-10-20' + '.'] },
    ],
  },
  terms: {
    title: 'Kullanım Koşulları',
    sections: [
      { title: 'Kabul', body: ['Uygulamayı kullanarak bu koşulları kabul edersiniz. Kabul etmiyorsanız uygulamayı kullanmayın.'] },
      { title: 'Hizmetin kapsamı', body: ['Uygulama kişisel harcamalarınızı kaydetmeniz ve izlemeniz için bir araçtır. Finansal, hukuki ya da vergi danışmanlığı değildir.', 'Gösterilen döviz kurları bilgi amaçlıdır ve üçüncü taraf kaynaklardan gelir; doğruluğunu ve güncelliğini garanti etmeyiz. Önemli kararlar için resmi kaynaklara bakın.'] },
      { title: 'Hesabınız', body: ['Hesap bilgilerinizin gizliliğinden ve hesabınızdaki işlemlerden siz sorumlusunuz. Doğru bilgi vermelisiniz. Hesabınızı dilediğiniz zaman Ayarlar\'dan silebilirsiniz.'] },
      { title: 'Kabul edilemez kullanım', body: ['Uygulamayı yasa dışı amaçlarla kullanmamalı, hizmeti bozmaya, tersine mühendisliğe ya da yetkisiz erişime çalışmamalısınız.'] },
      { title: 'Verileriniz ve yedekleme', body: ['Verileriniz cihazınızda tutulur. Cihazın kaybolması ya da uygulamanın silinmesi halinde verilerin kaybolmaması için Ayarlar\'daki yedekleme özelliğini düzenli kullanmanız önerilir.'] },
      { title: 'Sorumluluğun sınırı', body: ['Uygulama "olduğu gibi" sunulur. Yasaların izin verdiği ölçüde, uygulamanın kullanımından ya da kullanılamamasından doğan dolaylı zararlardan ve veri kaybından sorumlu değiliz. Bu sınırlama, kasıt ve ağır kusur ile emredici mevzuattan doğan sorumluluğu kapsamaz.'] },
      { title: 'Ücretli özellikler', body: ['Ücretli özellikler sunulursa fiyat, yenileme ve iptal koşulları satın alma ekranında ayrıca gösterilir.'] },
      { title: 'Değişiklikler ve uygulanacak hukuk', body: ['Koşulları güncelleyebiliriz; yeni sürüm uygulamada yayınlanır. Bu koşullara {law} uygulanır.', 'İletişim: {email}.'] },
    ],
  },
};

const en: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { title: 'Who we are', body: ['This app is provided by {controller} ("we"). For any question about your personal data, contact {email}.'] },
      { title: 'Where your data lives', body: [
        'Your expenses, budgets, subscriptions and settings are stored only on your device. In this version they are not sent to our servers.',
        'You can use the app without an account; in that case no personal data is shared with us.',
      ] },
      { title: 'What we collect if you create an account', body: [
        'Your email address, your name (if you provide one), your sign-in method (email, Apple or Google), when the account was created and last used, and the version and time of the policy and terms you accepted.',
        'If you sign up with email, your password is stored only as a one-way hash; we cannot see it.',
        'With Sign in with Apple you can hide your email; if you do, we only receive the relay address Apple provides.',
      ] },
      { title: 'Why we use it', body: [
        'To create your account and verify your session, send verification and password-reset emails, prevent abuse and meet legal obligations. We do not use it for marketing and we do not sell it.',
      ] },
      { title: 'Service providers', body: [
        'We use Supabase for account infrastructure; your account data is hosted in {region}. When you sign in with Apple or Google, that company\'s authentication service is involved.',
        'To show exchange rates the app requests rates from Frankfurter (frankfurter.dev) and ExchangeRate-API. Your expense data is not sent in these requests, but like any internet request your IP address is visible to those services.',
        'App updates are delivered through Expo\'s update service (EAS Update), which processes technical information such as the app version and platform, and your IP address, to choose the right update.',
        'This version contains no advertising, tracking or analytics tools.',
      ] },
      { title: 'Retention and deletion', body: [
        'We keep your account data while your account is open. In Settings > Account > Delete account you can permanently delete your account and all data on our servers immediately; if you signed in with Apple, your Apple authorization is also revoked. Technical backups at our providers may retain it for a limited time.',
        'Expense data on your device is removed by uninstalling the app or by choosing "also delete data on this device" when deleting the account.',
      ] },
      { title: 'Your rights', body: [
        'Under applicable law (Turkish KVKK art. 11; GDPR for EU/EEA users) you may access, correct, delete, restrict, object to and port your data. Send requests to {email}. You may also complain to your data protection authority.',
      ] },
      { title: 'Children', body: ['The app is not directed to children under 16 and we do not knowingly collect their data.'] },
      { title: 'Changes', body: ['If this policy changes we will publish the new version in the app and notify you of material changes. Version date: 2026-10-20.'] },
    ],
  },
  terms: {
    title: 'Terms of Use',
    sections: [
      { title: 'Acceptance', body: ['By using the app you accept these terms. If you do not accept them, do not use the app.'] },
      { title: 'What the service is', body: ['The app is a tool for recording and tracking your personal expenses. It is not financial, legal or tax advice.', 'Exchange rates are informational and come from third-party sources; we do not guarantee their accuracy or timeliness. Check official sources for important decisions.'] },
      { title: 'Your account', body: ['You are responsible for keeping your account credentials confidential and for activity on your account. Provide accurate information. You can delete your account at any time in Settings.'] },
      { title: 'Acceptable use', body: ['Do not use the app for unlawful purposes, or try to disrupt the service, reverse engineer it or gain unauthorized access.'] },
      { title: 'Your data and backups', body: ['Your data is kept on your device. To avoid losing it if the device is lost or the app is deleted, use the backup feature in Settings regularly.'] },
      { title: 'Limitation of liability', body: ['The app is provided "as is". To the extent permitted by law we are not liable for indirect damages or data loss arising from use or inability to use the app. This does not limit liability for intent, gross negligence or anything that cannot be limited by mandatory law.'] },
      { title: 'Paid features', body: ['If paid features are offered, price, renewal and cancellation terms will be shown separately at purchase.'] },
      { title: 'Changes and governing law', body: ['We may update these terms; the new version will be published in the app. These terms are governed by {law}.', 'Contact: {email}.'] },
    ],
  },
};

/** Çevirisi olmayan dillerde İngilizce metin gösterilir (ekranda dilindeki bir açıklamayla). */
export const hasLegalTranslation = (lang: Lang) => lang === 'tr' || lang === 'en';

export function legalDoc(kind: LegalKind, lang: Lang): LegalDoc {
  const src = (lang === 'tr' ? tr : en)[kind];
  return { title: src.title, sections: src.sections.map((s) => ({ title: s.title, body: s.body.map(fill) })) };
}
