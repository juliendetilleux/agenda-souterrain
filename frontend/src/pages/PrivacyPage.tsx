import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

const COOKIES = [
  { name: 'access_token',  duration: '15 min',    purposeKey: 'cookieAccessToken',  required: true },
  { name: 'refresh_token', duration: '7 d',       purposeKey: 'cookieRefreshToken', required: true },
  { name: 'csrf_token',    duration: 'Session',   purposeKey: 'cookieCsrf',         required: true },
  { name: 'cookie-consent', duration: '1 an / 1y', purposeKey: 'cookieConsent',      required: true },
  { name: 'i18nextLng',     duration: '1 an / 1y', purposeKey: 'cookieLanguage',     required: false },
  { name: 'pwa-dismissed',  duration: '30 d',      purposeKey: 'cookiePwa',          required: false },
]

export default function PrivacyPage() {
  const { t } = useTranslation('privacy')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - cave dark, branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-cave flex-col justify-between p-14 flex-shrink-0">
        <div>
          <p className="text-lamp-500 text-xs font-bold uppercase tracking-[0.25em] mb-8">
            {'\u2193'} {tc('brand')}
          </p>
          <h1 className="text-4xl font-bold text-cave-text-active leading-[1.15] tracking-tight">
            {t('page.title')}
          </h1>
          <p className="mt-6 text-cave-text text-sm leading-relaxed max-w-xs">
            {t('page.intro')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-lamp-500" />
          <p className="text-cave-text text-xs">{tc('copyright')}</p>
        </div>
      </div>

      {/* Right panel - scrollable content */}
      <div className="flex-1 bg-[#f8f7f4] overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#f8f7f4]/95 backdrop-blur-sm border-b border-stone-200/60">
          <div className="max-w-2xl mx-auto px-6 sm:px-8 py-3 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              <span className="text-base leading-none">{'\u2190'}</span>
              {t('page.backButton')}
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-6 sm:px-8 py-10">
          {/* Mobile brand + title */}
          <div className="lg:hidden mb-6 text-center">
            <p className="text-lamp-600 text-xs font-bold uppercase tracking-[0.2em] mb-2">
              {'\u2193'} {tc('brand')}
            </p>
          </div>

          <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">
            {t('page.title')}
          </h1>
          <p className="text-stone-400 text-sm mb-8">{t('page.lastUpdated')}</p>

          <p className="text-stone-600 text-sm leading-relaxed mb-10">
            {t('page.intro')}
          </p>

          {/* Sections */}
          <div className="space-y-10">
            {/* Responsable du traitement */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.controller')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{t('page.controllerText')}</p>
            </section>

            {/* Donnees collectees */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.dataCollected')}</h2>
              <ul className="space-y-2">
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.dataAccount')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.dataCalendar')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.dataTechnical')}
                </li>
              </ul>
            </section>

            {/* Finalites du traitement */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.purposes')}</h2>
              <ul className="space-y-2">
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.purposeService')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.purposeAuth')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.purposeEmail')}
                </li>
              </ul>
            </section>

            {/* Base legale */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.legalBasis')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{t('page.legalBasisText')}</p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.cookies')}</h2>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                        {t('page.cookieName')}
                      </th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                        {t('page.cookieDuration')}
                      </th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                        {t('page.cookiePurpose')}
                      </th>
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                        {t('page.cookieRequired')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIES.map((cookie) => (
                      <tr key={cookie.name} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                        <td className="py-2.5 px-2 text-stone-700 font-mono text-xs">
                          {cookie.name}
                        </td>
                        <td className="py-2.5 px-2 text-stone-500">
                          {cookie.duration}
                        </td>
                        <td className="py-2.5 px-2 text-stone-600">
                          {t(`page.${cookie.purposeKey}`)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={cookie.required ? 'text-lamp-600 font-medium' : 'text-stone-400'}>
                            {cookie.required ? t('page.cookieYes') : t('page.cookieNo')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Duree de conservation */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.retention')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{t('page.retentionText')}</p>
            </section>

            {/* Partage des donnees */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.sharing')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed mb-3">{t('page.sharingText')}</p>
              <ul className="space-y-2">
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.sharingCloudflare')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.sharingRender')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.sharingNeon')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.sharingResend')}
                </li>
              </ul>
            </section>

            {/* Transferts internationaux */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.transfers')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{t('page.transfersText')}</p>
            </section>

            {/* Vos droits */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.rights')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed mb-3">{t('page.rightsText')}</p>
              <ul className="space-y-2">
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.rightAccess')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.rightRectification')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.rightDeletion')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.rightPortability')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.rightObjection')}
                </li>
                <li className="text-stone-600 text-sm leading-relaxed flex gap-2">
                  <span className="text-lamp-500 mt-1 flex-shrink-0">{'\u2022'}</span>
                  {t('page.rightRestriction')}
                </li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.contact')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{t('page.contactText')}</p>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">{t('page.changes')}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{t('page.changesText')}</p>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-14 pt-6 border-t border-stone-200">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-lamp-500" />
              <p className="text-stone-400 text-xs">{tc('copyright')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
