/* eslint-disable */
/* ==========================================================================
   הגדרות Google Maps
   --------------------------------------------------------------------------
   מלאו כאן את מפתח ה-API ואז המפה תעבוד. הוראות מלאות ב-README.
   ========================================================================== */

window.CONFIG = {
  /**
   * מפתח Google Maps JavaScript API.
   * להשיג ב-https://console.cloud.google.com/google/maps-apis/credentials
   * חובה להגביל אותו ל-HTTP referrer של הדומיין שלכם (ראו README).
   */
  GOOGLE_MAPS_API_KEY: 'AIzaSyBdE3qCAdRsXirpcDeFuM5jpSf1hQSMgq8',

  /**
   * אופציונלי — Map ID מ-Google Cloud Console.
   * אם ימולא, הסמנים יהיו Advanced Markers (עיצוב יפה יותר),
   * אבל צבעי המפה נשלטים אז מהענן ולא מהקוד.
   * אם יישאר ריק — סמנים קלאסיים + סגנון כהה אוטומטי. שניהם עובדים.
   */
  MAP_ID: '',

  /**
   * שפת שמות המקומות על המפה:
   *   'iw' — עברית (נוח לקריאה)
   *   'sk' — סלובקית (מה שכתוב על השלטים בשטח)
   *   'en' — אנגלית
   */
  MAP_LANGUAGE: 'iw',

  /** סוג המפה ההתחלתי: 'terrain' | 'roadmap' | 'hybrid' | 'satellite' */
  MAP_TYPE: 'terrain',
};
