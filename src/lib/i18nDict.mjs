/**
 * Translation dictionary and pure lookup for the EN/TR UI.
 *
 * Lives in .mjs (with a thin re-export from i18n.svelte.ts) so `node --test`
 * can assert dictionary invariants without a build step — the same convention
 * eligibility/roadmapLogic/prereqGraph/paletteSearch/termHistory follow.
 *
 * The reactive half (the `lang` rune, localStorage persistence, the dev-mode
 * missing-key warning) stays in i18n.svelte.ts; everything here is pure.
 */

/**
 * @typedef {"en" | "tr"} Lang
 * @typedef {{ en: string, tr: string }} Entry
 */

/** @type {Record<string, Entry>} */
export const dict = {
  "header.title": { en: "BOUN Course Planner", tr: "BOUN Ders Planlayıcı" },
  "search.placeholder": { en: "Search courses", tr: "Ders ara" },
  "header.semester": { en: "Semester", tr: "Dönem" },
  "filters.open": { en: "Filter Courses", tr: "Dersleri Filtrele" },
  "filters.showWithoutSchedule": {
    en: "Show courses without schedule",
    tr: "Programı olmayan dersleri göster",
  },
  "filters.selectAll": { en: "Select all", tr: "Tümünü seç" },
  "filters.unselectAll": { en: "Unselect all", tr: "Tümünü bırak" },
  "filters.apply": { en: "Apply", tr: "Uygula" },
  "day.Mon": { en: "Mon", tr: "Pzt" },
  "day.Tue": { en: "Tue", tr: "Sal" },
  "day.Wed": { en: "Wed", tr: "Çar" },
  "day.Thu": { en: "Thu", tr: "Per" },
  "day.Fri": { en: "Fri", tr: "Cum" },
  "day.Sat": { en: "Sat", tr: "Cmt" },
  "course.conflict": { en: "Conflict", tr: "Çakışma" },
  "course.requiredFor": {
    en: "Required for department:",
    tr: "Şu bölümler için zorunlu:",
  },
  "course.departments": { en: "Departments:", tr: "Bölümler:" },
  "course.prerequisite": { en: "Prerequisite:", tr: "Ön koşul:" },
  "course.consentRequired": {
    en: "Instructor consent required",
    tr: "Hocadan onay gerekli",
  },
  "course.minGpa": { en: "Min. GPA:", tr: "Min. GPA:" },
  "course.showDescription": { en: "Show description", tr: "Açıklamayı göster" },
  // Accessible names for the icon-only card controls; axe flagged all three as
  // nameless (button-name / link-name, critical and serious).
  "course.addSection": { en: "Add to schedule", tr: "Programa ekle" },
  "course.removeSection": { en: "Remove from schedule", tr: "Programdan çıkar" },
  "course.syllabusLink": {
    en: "Official course page",
    tr: "Resmî ders sayfası",
  },
  "course.hideDescription": { en: "Hide description", tr: "Açıklamayı gizle" },
  "course.catalogPrerequisite": {
    en: "Catalog prerequisite:",
    tr: "Katalog ön koşulu:",
  },
  "course.taken": { en: "Taken", tr: "Alındı" },
  "course.eligible": { en: "Eligible", tr: "Alınabilir" },
  "course.needs": { en: "Needs:", tr: "Gerekli:" },
  "course.markTaken": { en: "Mark as taken", tr: "Alındı olarak işaretle" },
  "course.markNotTaken": { en: "Unmark as taken", tr: "İşareti kaldır" },
  "list.courses": { en: "Courses", tr: "Dersler" },
  "list.copyLink": { en: "Copy Link", tr: "Bağlantıyı Kopyala" },
  "list.copied": { en: "Copied!", tr: "Kopyalandı!" },
  "calendar.addToCalendar": { en: "Add to Calendar", tr: "Takvime Ekle" },
  "calendar.howToImport": { en: "How to import?", tr: "Nasıl içe aktarılır?" },
  "calendar.tooltipIcs": {
    en: "Download calendar file (.ics)",
    tr: "Takvim dosyasını indir (.ics)",
  },
  "calendar.tooltipSelectCourses": {
    en: "Select courses to enable calendar export",
    tr: "Takvim dışa aktarımı için ders seçin",
  },
  // The `en` slot used to hold the Turkish sentence verbatim, so English users
  // saw Turkish on a disabled export button. semester-dates.json covers only
  // 6 of the 25 terms, so this is the normal case for older terms.
  "calendar.tooltipNoDates": {
    en: "Calendar dates for this semester have not been added yet",
    tr: "Bu dönem için takvim tarihleri henüz eklenmedi",
  },
  "calendar.addToGcal": {
    en: "Add to Google Calendar",
    tr: "Google Takvim'e Ekle",
  },
  "calendar.instructionsTitle": {
    en: "Import Calendar Instructions:",
    tr: "Takvimi içe aktarma talimatları:",
  },
  "instructions.macos": {
    en: "Double-click the .ics file to open in Calendar app",
    tr: ".ics dosyasına çift tıklayarak Takvim uygulamasında açın",
  },
  "instructions.windows": {
    en: "Double-click to open in Outlook or Calendar app",
    tr: "Outlook veya Takvim uygulamasında açmak için çift tıklayın",
  },
  "instructions.gcal": {
    en: "Go to Settings -> Import & Export -> Import",
    tr: "Ayarlar -> İçe & Dışa Aktarma -> İçe Aktar bölümüne gidin",
  },
  "instructions.outlook": {
    en: "Click 'Add calendar' -> 'Upload from file'",
    tr: "'Takvim ekle' -> 'Dosyadan yükle' seçeneğine tıklayın",
  },
  "footer.dataUpdated": { en: "Schedule data updated:", tr: "Ders verisi güncellendi:" },
  "footer.goodLuck": {
    en: "Good luck in the new semester!",
    tr: "Yeni dönemde başarılar!",
  },
  "footer.registration": { en: "BOUN registration", tr: "BOUN kayıt" },
  // Split around the inline link; each half is written to read grammatically in
  // its own language, so the halves are not word-for-word translations.
  "footer.disclaimerPre": {
    en: "This website has no affiliation with Boğaziçi University. Please check",
    tr: "Bu sitenin Boğaziçi Üniversitesi ile bir bağı yoktur. En güncel program için",
  },
  "footer.disclaimerPost": {
    en: "for the most up-to-date schedule; this page may sometimes lag behind it.",
    tr: "sayfasını esas alın; bu sayfa zaman zaman onun gerisinde kalabilir.",
  },
  "roadmap.title": { en: "Roadmap", tr: "Yol Haritası" },
  "roadmap.addCourse": { en: "Add course…", tr: "Ders ekle…" },
  "roadmap.prereqUnmet": {
    en: "Prereq not met before this term",
    tr: "Ön koşul bu döneme kadar tamamlanmamış",
  },
  "roadmap.prereqOk": { en: "Prerequisites met", tr: "Ön koşullar tamam" },
  "roadmap.credits": { en: "credits", tr: "kredi" },
  "roadmap.empty": { en: "Add courses to plan this term", tr: "Bu dönem için ders ekleyin" },
  "roadmap.fromTerm": { en: "Picking from", tr: "Kaynak dönem" },
  "roadmap.clear": { en: "Clear roadmap", tr: "Planı temizle" },
  "roadmap.overload": {
    en: "Heavy load — BOUN norm is ~30 ECTS/term",
    tr: "Ağır yük — BOÜZ normu dönemde ~30 ECTS",
  },
  "palette.title": { en: "Course palette", tr: "Ders paleti" },
  "palette.placeholder": {
    en: "Search by code, name, instructor…",
    tr: "Kod, ad, hoca ara…",
  },
  "palette.noResults": { en: "No matching courses", tr: "Eşleşen ders yok" },
  "palette.navigate": { en: "navigate", tr: "gez" },
  "palette.add": { en: "add", tr: "ekle" },
  "palette.close": { en: "close", tr: "kapat" },
  "palette.openTitle": {
    en: "Open course palette (Ctrl/Cmd+K)",
    tr: "Ders paletini aç (Ctrl/Cmd+K)",
  },
  "palette.unscheduled": { en: "Unscheduled", tr: "Programsız" },
  "palette.full": { en: "Full", tr: "Dolu" },
  // Rendered as "{n} seats left", so the value comes first in both languages.
  "palette.seatsLeft": { en: "seats left", tr: "yer kaldı" },
  "palette.credits": { en: "Cr", tr: "Kr" },
  "palette.alreadyAdded": { en: "already added", tr: "zaten ekli" },
  "palette.results": { en: "Course results", tr: "Ders sonuçları" },
  "palette.sections": { en: "sections", tr: "şube" },
  "roadmap.predicted": { en: "Predicted", tr: "Tahmini" },
  // The roadmap must never present inference as an official listing; these two
  // notes are what keep a synthesised future term honest.
  "roadmap.predictedNote": {
    en: "Inferred from past terms — not an official listing",
    tr: "Geçmiş dönemlerden çıkarıldı — resmî ilan değil",
  },
  "roadmap.unavailable": { en: "Not expected", tr: "Beklenmiyor" },
  "roadmap.unavailableNote": {
    en: "Never offered in this season in the recorded history",
    tr: "Kayıtlı geçmişte bu mevsimde hiç açılmamış",
  },
  "roadmap.seasonCount": {
    en: "Times offered in this season",
    tr: "Bu mevsimde açılma sayısı",
  },
  "roadmap.otherSeasonsOnly": {
    en: "Offered only in other seasons",
    tr: "Yalnızca diğer mevsimlerde açıldı",
  },
  "roadmap.lastOffered": { en: "Last offered", tr: "Son açılma" },
  "roadmap.estimatedLoad": {
    en: "Estimated from the most recent known offering",
    tr: "En son bilinen açılıştan tahmin edildi",
  },
  "course.prereqTree": { en: "Prerequisite tree", tr: "Ön koşul ağacı" },
  "course.showTree": { en: "Show prereq tree", tr: "Ön koşul ağacını göster" },
  "course.hideTree": { en: "Hide prereq tree", tr: "Ön koşul ağacını gizle" },
  "course.eligibleTitle": {
    en: "Every prerequisite we have on record for this course is complete.",
    tr: "Bu ders için kayıtlı tüm ön koşullar tamamlanmış.",
  },
  // "Absent from the prerequisite data" is not "has no prerequisites". 314 of
  // the current term's courses were never crawled, and the card used to render
  // them identically to a verified pass.
  "course.prereqUnknown": { en: "prereqs unchecked", tr: "ön koşul bilinmiyor" },
  "course.prereqUnknownTitle": {
    en: 'This course is not in our prerequisite data, so eligibility has not been checked. Absent is not the same as "no prerequisites".',
    tr: 'Bu ders ön koşul verimizde yok, bu yüzden alınabilirlik kontrol edilmedi. Verinin olmaması "ön koşulu yok" demek değildir.',
  },
  "course.searchInstructor": {
    en: "Show this instructor's sections",
    tr: "Bu hocanın derslerini göster",
  },
  "course.delivery": { en: "Delivery:", tr: "Ders şekli:" },
  "course.finalExam": { en: "Final exam:", tr: "Final sınavı:" },
  "course.examSession": { en: "session", tr: "oturum" },
  "course.examLocation": { en: "Exam location:", tr: "Sınav yeri:" },
  "course.examClash": {
    en: "Final exam clashes with {keys}",
    tr: "Final sınavı {keys} ile çakışıyor",
  },
  // An unparseable exam cell must never be reported as "no clash".
  "course.examMaybeClash": {
    en: "Same final-exam day as {keys} — session unknown",
    tr: "{keys} ile aynı final gününde — oturum bilinmiyor",
  },
  "course.examNoClash": { en: "No final-exam clash", tr: "Final çakışması yok" },
  "quota.seats": {
    en: "{current}/{quota} seats taken",
    tr: "{current}/{quota} kontenjan dolu",
  },
  "quota.left": { en: "{n} left", tr: "{n} boş" },
  "quota.full": { en: "FULL", tr: "DOLU" },
  "quota.over": { en: "over-enrolled by {n}", tr: "{n} kişi fazla kayıtlı" },
  "quota.capacity": { en: "Room capacity {cap}", tr: "Sınıf kapasitesi {cap}" },
  "quota.enrolmentUnpublished": {
    en: "enrolment not published",
    tr: "kayıt sayısı yayınlanmadı",
  },
  // MUST stay digit-free in both languages: e2e/quota.spec.ts proves we never
  // fabricate a "0" for unknown enrolment by asserting this state has no digit.
  "quota.noData": { en: "Seats: no data", tr: "Kontenjan: veri yok" },
  "quota.restricted": { en: "Only {depts}", tr: "Sadece {depts}" },
  "quota.surname": { en: "Surname restriction", tr: "Soyadı kısıtı" },
  "quota.asOf": { en: "as of {time}", tr: "{time} itibarıyla" },
  "quota.scrapedTitle": {
    en: "Enrolment snapshot taken {time}. These numbers change continuously during registration.",
    tr: "Kayıt anlık görüntüsü {time} tarihinde alındı. Bu sayılar kayıt döneminde sürekli değişir.",
  },
  // Offering-likelihood tiers from futureTerms.mjs. Deliberately hedged
  // wording: only "known" is a published fact, the rest are inference from
  // offerings.json history and must never read as an official listing.
  "roadmap.conf.known": { en: "Published", tr: "Yayınlandı" },
  "roadmap.conf.high": { en: "Very likely", tr: "Çok olası" },
  "roadmap.conf.medium": { en: "Likely", tr: "Olası" },
  "roadmap.conf.low": { en: "Uncertain", tr: "Belirsiz" },
  "roadmap.conf.none": { en: "Unlikely", tr: "Olası değil" },
  // Prefilled GitHub issue for a data error. The body used to be hardcoded
  // Turkish no matter the UI language.
  "report.title": { en: "Data error", tr: "Veri hatası" },
  "report.term": { en: "Term", tr: "Dönem" },
  "report.key": { en: "Key", tr: "Anahtar" },
  "report.code": { en: "Code", tr: "Kod" },
  "report.name": { en: "Name", tr: "Ad" },
  "report.instructor": { en: "Instructor", tr: "Hoca" },
  "report.days": { en: "Days", tr: "Günler" },
  "report.hours": { en: "Hours", tr: "Saatler" },
  "report.rooms": { en: "Rooms", tr: "Odalar" },
  "report.reason": {
    en: "This information is wrong or missing because:",
    tr: "Bu bilgiler yanlış/eksik çünkü:",
  },
  "report.source": { en: "Source page", tr: "Kaynak sayfa" },
  "report.tooltip": { en: "Report incorrect data", tr: "Hatalı veriyi bildir" },
  "instructor.title": { en: "Instructor", tr: "Öğretim üyesi" },
  "instructor.sections": { en: "{n} sections this term", tr: "Bu dönem {n} şube" },
  "instructor.clear": { en: "Clear", tr: "Temizle" },
  "instructor.scopeNote": {
    en: "Listing only this instructor's sections; other filters are off.",
    tr: "Yalnızca bu öğretim üyesinin şubeleri listeleniyor; diğer filtreler kapalı.",
  },
  "instructor.alsoListedAs": {
    en: "Also listed as: {names}",
    tr: "Şu şekilde de yazılmış: {names}",
  },
  "instructor.matches": { en: "Instructors:", tr: "Öğretim üyeleri:" },
  "instructor.history": { en: "Teaching history", tr: "Ders geçmişi" },
  // Only the currently loaded terms are indexed; the other 24 term files are
  // ~12 MB, so the scope has to be stated rather than implied.
  "instructor.historyScope": { en: "last {n} terms", tr: "son {n} dönem" },
  "instructor.historyCurrentOnly": {
    en: "this term only",
    tr: "yalnızca bu dönem",
  },
  "instructor.historyLoading": {
    en: "loading earlier terms…",
    tr: "önceki dönemler yükleniyor…",
  },
  "instructor.termsTaught": {
    en: "{n} of {m} terms",
    tr: "{m} dönemin {n} tanesinde",
  },
  "instructor.alsoTaughtBy": { en: "Also taught by:", tr: "Ayrıca veren:" },
  "instructor.moreCourses": { en: "+{n} more courses", tr: "+{n} ders daha" },
  "timetable.semesterStart": { en: "Start", tr: "Başlangıç" },
  "timetable.semesterEnd": { en: "End", tr: "Bitiş" },
  "timetable.exportPng": { en: "Download PNG", tr: "PNG İndir" },
  "timetable.exportPngEmpty": {
    en: "Select courses to enable image export",
    tr: "Resim dışa aktarımı için ders seçin",
  },
  "course.offeredTerms": {
    en: "Offered in {n} terms since 2017",
    tr: "2017'den beri {n} dönemde açıldı",
  },
  "list.empty": { en: "You have no selected course", tr: "Seçili dersiniz yok" },
  // The TR wording here is load-bearing: e2e/helpers.ts locates the figure with
  // /(Total Credits|Toplam Kredi)/i, so changing it breaks every spec that
  // reads the credit total.
  "list.totalCredits": { en: "Total Credits:", tr: "Toplam Kredi:" },
  "list.findConflictFree": {
    en: "Find conflict-free sections",
    tr: "Çakışmasız şubeleri bul",
  },
  "list.undo": { en: "Undo", tr: "Geri al" },
  "list.solverApplied": {
    en: "Applied conflict-free schedule",
    tr: "Çakışmasız program uygulandı",
  },
  // Two distinct facts that must never be conflated: the search tree was fully
  // explored and no combination exists, versus the search was cut off at the
  // trial budget and nothing was proven either way.
  "list.solverUnsatisfiable": {
    en: "No conflict-free combination exists; blocked by",
    tr: "Çakışmasız bir kombinasyon yok; engelleyen",
  },
  "list.solverGaveUp": {
    en: "Search gave up before proving anything; it stalled at",
    tr: "Arama bir sonuca varmadan vazgeçti; takıldığı yer",
  },
  "list.solverGaveUpHint": {
    en: "Remove a few courses and try again.",
    tr: "Birkaç dersi çıkarıp tekrar deneyin.",
  },
  // groupKey only strips a trailing ".NN", so the 203 keys ending in "LAB N" /
  // "P.S. N" each form a group of one and are never reshuffled — which makes a
  // bare "no combination exists" narrower than it sounds.
  "list.solverLabsFixed": {
    en: "Labs and problem sessions are tied to their lecture section, so the solver never swaps them.",
    tr: "Laboratuvar ve problem seansları ait oldukları şubeye bağlıdır; çözücü bunları değiştirmez.",
  },
  "calendar.datesLoadFailed": {
    en: "Term dates could not be loaded, so calendar export is unavailable.",
    tr: "Dönem tarihleri yüklenemedi, bu yüzden takvim dışa aktarımı kullanılamıyor.",
  },
  "catalogue.showMore": { en: "Show more", tr: "Daha fazla" },
  "catalogue.showLess": { en: "Show less", tr: "Daha az" },
  "catalogue.loading": { en: "Loading…", tr: "Yükleniyor…" },
};

/**
 * Look a key up without any reactive dependency.
 *
 * Returns the key itself as `text` when it is missing, so a gap degrades to a
 * visible but harmless placeholder instead of an empty element — and reports
 * `missing` so the caller can warn in development.
 *
 * @param {string} key
 * @param {Lang} lang
 * @returns {{ text: string, missing: boolean }}
 */
export function lookup(key, lang) {
  const entry = dict[key];
  if (!entry) {
    return { text: key, missing: true };
  }
  return { text: entry[lang], missing: false };
}

/**
 * Substitute `{name}` placeholders. Unknown placeholders are left untouched so
 * a typo is visible in the UI rather than silently blanking the value.
 *
 * @param {string} text
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function interpolate(text, vars) {
  if (!vars) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Placeholder names used by an entry, e.g. "{n} of {total}" -> ["n", "total"].
 *
 * @param {string} text
 * @returns {string[]}
 */
export function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
