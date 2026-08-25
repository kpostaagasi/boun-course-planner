export type Lang = "en" | "tr";

const dict: Record<string, { en: string; tr: string }> = {
  "header.title": { en: "BOUN Course Planner", tr: "BOUN Ders Planlayıcı" },
  "search.placeholder": { en: "Search courses", tr: "Ders ara" },
  "filters.open": { en: "Filter Courses", tr: "Dersleri Filtrele" },
  "filters.showWithoutSchedule": {
    en: "Show courses without schedule",
    tr: "Programı olmayan dersleri göster",
  },
  "filters.selectAll": { en: "Select all", tr: "Tümünü seç" },
  "filters.unselectAll": { en: "Unselect all", tr: "Tümünü bırak" },
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
  "course.showDescription": { en: "Show description ▼", tr: "Açıklamayı göster ▼" },
  "course.hideDescription": { en: "Hide description ▲", tr: "Açıklamayı gizle ▲" },
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
  "calendar.tooltipNoDates": {
    en: "Bu dönem için takvim tarihleri henüz eklenmedi",
    tr: "Bu dönem için takvim tarihleri henüz eklenmedi",
  },
  "calendar.addToGcal": {
    en: "Add to Google Calendar",
    tr: "Google Takvim'e Ekle",
  },
  "calendar.gcalTooMany": {
    en: "Use .ics download for more than 6 courses",
    tr: "6 dersten fazlası için .ics indirin",
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
    en: "Go to Settings → Import & Export → Import",
    tr: "Ayarlar → İçe & Dışa Aktarma → İçe Aktar bölümüne gidin",
  },
  "instructions.outlook": {
    en: "Click 'Add calendar' → 'Upload from file'",
    tr: "'Takvim ekle' → 'Dosyadan yükle' seçeneğine tıklayın",
  },
  "footer.dataUpdated": { en: "Schedule data updated:", tr: "Ders verisi güncellendi:" },
  "footer.goodLuck": {
    en: "Good luck in the new semester!",
    tr: "Yeni dönemde başarılar!",
  },
  "footer.registration": { en: "BOUN registration", tr: "BOUN kayıt" },
  "roadmap.title": { en: "Roadmap", tr: "Yol Haritası" },
  "roadmap.addCourse": { en: "Add course…", tr: "Ders ekle…" },
  "roadmap.prereqUnmet": { en: "Prereq not met before this term", tr: "Ön koşul bu döneme kadar tamamlanmamış" },
  "roadmap.prereqOk": { en: "Prerequisites met", tr: "Ön koşullar tamam" },
  "roadmap.credits": { en: "credits", tr: "kredi" },
  "roadmap.empty": { en: "Add courses to plan this term", tr: "Bu dönem için ders ekleyin" },
  "roadmap.fromTerm": { en: "Picking from", tr: "Kaynak dönem" },
  "roadmap.clear": { en: "Clear roadmap", tr: "Planı temizle" },
  "palette.title": { en: "Course palette", tr: "Ders paleti" },
  "palette.placeholder": { en: "Search by code, name, instructor…", tr: "Kod, ad, hoca ara…" },
  "palette.noResults": { en: "No matching courses", tr: "Eşleşen ders yok" },
  "palette.navigate": { en: "navigate", tr: "gez" },
  "palette.add": { en: "add", tr: "ekle" },
  "palette.close": { en: "close", tr: "kapat" },
  "palette.openTitle": { en: "Open course palette (Ctrl/Cmd+K)", tr: "Ders paletini aç (Ctrl/Cmd+K)" },
  "course.prereqTree": { en: "Prerequisite tree", tr: "Ön koşul ağacı" },
  "course.showTree": { en: "Show prereq tree", tr: "Ön koşul ağacını göster" },
  "course.hideTree": { en: "Hide prereq tree", tr: "Ön koşul ağacını gizle" },

};
let lang = $state<Lang>("en");

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem("lang", l);
  } catch {
    // localStorage unavailable (private mode etc.); keep in-memory only.
  }
}

export function getLang(): Lang {
  return lang;
}

export function initLang() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("lang");
  } catch {
    // ignore
  }
  if (stored === "tr") {
    lang = "tr";
    return;
  }
  if (stored === "en") {
    lang = "en";
    return;
  }
  const navLang =
    typeof navigator !== "undefined" ? navigator.language : "en";
  lang = navLang.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function t(key: string): string {
  const entry = dict[key];
  return entry ? entry[lang] : key;
}
