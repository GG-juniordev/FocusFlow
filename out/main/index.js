// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let node_path = require("node:path");
node_path = __toESM(node_path);
let electron = require("electron");
let path = require("path");
let node_fs = require("node:fs");
node_fs = __toESM(node_fs);
let node_crypto = require("node:crypto");
// src/shared/i18n/en.ts
var en = {
	"nav.focus": "Focus",
	"nav.tasks": "Tasks",
	"nav.calendar": "Calendar",
	"nav.settings": "Settings",
	"nav.zen": "Zen mode",
	"focus.title": "Current focus",
	"focus.start": "Start",
	"focus.resume": "Resume",
	"focus.pause": "Pause",
	"focus.reset": "Reset",
	"focus.complete": "Complete",
	"focus.addFive": "Add 5 minutes",
	"focus.clear": "Stop focusing on this",
	"focus.zen": "Shrink to floating bar",
	"focus.expand": "Open FocusFlow",
	"focus.paused": "Paused",
	"focus.running": "Focusing",
	"focus.ready": "Ready",
	"focus.timeUp": "Time's up",
	"focus.timeUpHint": "Mark it complete, or add 5 minutes and keep going.",
	"focus.spent": "{time} spent so far",
	"focus.estimate": "{time} planned",
	"focus.none": "Nothing in focus",
	"focus.noneHint": "Pick one task. Everything else can wait.",
	"focus.noneEmpty": "Add your first task and it will show up here.",
	"focus.upNext": "Up next",
	"focus.pick": "Pick a task to focus on",
	"focus.breakOffer": "Done. Take a break?",
	"focus.breakOfferHint": "{time} away from the screen, then on to the next task.",
	"focus.break": "Break",
	"focus.breakOver": "Break is over",
	"focus.startBreak": "Start break",
	"focus.skipBreak": "Skip break",
	"focus.endBreak": "End break",
	"focus.now": "Focus now",
	"focus.inFocus": "In focus",
	"tasks.title": "Tasks",
	"tasks.new": "New task",
	"tasks.quickAdd": "Add a task and press Enter",
	"tasks.count": "{n} to do",
	"tasks.all": "All",
	"tasks.none": "No category",
	"tasks.done": "Done",
	"tasks.empty": "No tasks yet",
	"tasks.emptyHint": "Type a task above and press Enter.",
	"tasks.emptyFilter": "No tasks in this category",
	"tasks.edit": "Edit task",
	"tasks.delete": "Delete task",
	"tasks.markDone": "Mark as done",
	"tasks.markTodo": "Mark as to do",
	"tasks.reorder": "Drag to reorder",
	"tasks.overdue": "Overdue",
	"tasks.today": "Today",
	"tasks.tomorrow": "Tomorrow",
	"field.title": "Title",
	"field.notes": "Notes",
	"field.notesPlaceholder": "Details, links, the first step…",
	"field.duration": "Estimated time",
	"field.custom": "Custom",
	"field.minutes": "minutes",
	"field.priority": "Priority",
	"field.category": "Category",
	"field.due": "Date",
	"field.tools": "Tools & resources",
	"field.start": "Starts",
	"tools.placeholder": "Add a tool or paste a link, then press Enter",
	"tools.remove": "Remove {name}",
	"tools.save": "Save {name} to my tools",
	"tools.open": "Open {name}",
	"tools.needed": "What you need",
	"field.end": "Ends",
	"field.length": "Length",
	"priority.high": "High",
	"priority.medium": "Medium",
	"priority.low": "Low",
	"cal.title": "Calendar",
	"cal.today": "Today",
	"cal.day": "Day",
	"cal.week": "Week",
	"cal.month": "Month",
	"cal.prev": "Previous",
	"cal.next": "Next",
	"cal.backlog": "Backlog",
	"cal.backlogHint": "Drag a task onto the calendar to block time for it.",
	"cal.backlogEmpty": "Every task is scheduled or done.",
	"cal.newBlock": "New time block",
	"cal.editBlock": "Edit time block",
	"cal.blockTitle": "What is this time for?",
	"cal.toTask": "Convert to task",
	"cal.linked": "Linked to a task",
	"cal.endBeforeStart": "The end time must be after the start time.",
	"set.title": "Settings",
	"set.appearance": "Appearance",
	"set.theme": "Theme",
	"set.theme.dark": "Dark",
	"set.theme.light": "Light",
	"set.theme.system": "Match Windows",
	"set.accent": "Accent color",
	"set.accentCustom": "Custom color",
	"set.language": "Language",
	"set.themeOverridden": "Your custom background sets the text colors.",
	"set.background": "Background",
	"set.bgHint": "Text colors adjust automatically to stay readable.",
	"set.bgDefault": "Theme default",
	"set.bgCustom": "Custom",
	"set.surface": "Cards & panels",
	"set.surfaceAuto": "Automatic",
	"set.surfaceCustom": "Custom card color",
	"set.preview": "Preview",
	"set.previewTitle": "Write the project summary",
	"set.previewBody": "Secondary text looks like this.",
	"set.contrast.excellent": "Text contrast {ratio}:1, very easy to read",
	"set.contrast.good": "Text contrast {ratio}:1, easy to read",
	"set.contrast.low": "Text contrast {ratio}:1, hard to read. Choose a lighter or darker card color.",
	"bg.oled": "Pure Black",
	"bg.slate": "Deep Slate",
	"bg.midnight": "Midnight Blue",
	"bg.forest": "Night Forest",
	"bg.paper": "Warm Paper",
	"bg.gray": "Soft Gray",
	"bg.white": "Clean White",
	"set.tools": "Tools & resources",
	"set.toolsHint": "These appear as quick picks when you edit a task. Click an icon to change it.",
	"set.toolsEmpty": "No tools yet. Add one below, or restore the built-in ones.",
	"set.toolName": "Name",
	"set.toolUrl": "Link (optional)",
	"set.toolAdd": "Name or link of a new tool",
	"set.deleteTool": "Delete {name}",
	"set.restoreTools": "Restore built-in tools",
	"set.toolIcon": "Change icon for {name}",
	"set.newToolIcon": "Icon for the new tool",
	"icon.default": "Default",
	"icon.emoji": "Emoji",
	"icon.image": "Image",
	"icon.emojiInput": "Type or paste an emoji",
	"icon.emojiHint": "Press Win + . to open the Windows emoji panel.",
	"icon.upload": "Choose an image…",
	"icon.replace": "Choose another image…",
	"icon.uploadHint": "PNG, JPG, SVG, WebP or ICO. It is resized to a small square icon.",
	"icon.uploadError": "That file could not be used as an icon. Try a PNG or JPG under 5 MB.",
	"icon.defaultHint": "Uses the built-in icon for this tool.",
	"common.done": "Done",
	"set.timer": "Timer",
	"set.focusMin": "Default focus session",
	"set.focusMinHint": "Used when a task has no estimate.",
	"set.breakMin": "Default break",
	"set.behavior": "Windows",
	"set.startup": "Launch when Windows starts",
	"set.startupDev": "Takes effect in the installed app, not in development mode.",
	"set.startMin": "Start minimized to the tray",
	"set.startMinHint": "At startup, stay in the tray until you click the icon.",
	"set.onTop": "Keep the window on top",
	"set.sounds": "Notification sounds",
	"set.categories": "Categories",
	"set.categoryName": "Category name",
	"set.addCategory": "Add category",
	"set.deleteCategory": "Delete category",
	"set.newCategory": "New category",
	"set.data": "Your data",
	"set.dataHint": "Stored only on this computer.",
	"set.openFolder": "Open folder",
	"common.save": "Save",
	"common.cancel": "Cancel",
	"common.delete": "Delete",
	"common.close": "Close",
	"common.add": "Add",
	"tray.show": "Open FocusFlow",
	"tray.quit": "Quit",
	"tray.noFocus": "No task in focus",
	"tray.left": "{time} left",
	"tray.hintTitle": "FocusFlow is still running",
	"tray.hintBody": "It stays in the system tray. Right-click the icon to quit.",
	"notify.timeUpTitle": "Time's up",
	"notify.timeUpBody": "Your focus session for \"{task}\" has finished.",
	"notify.breakOverTitle": "Break is over",
	"notify.breakOverBody": "Pick your next task.",
	"notify.soonTitle": "Starting in {n} min",
	"notify.soonBody": "{title} starts at {time}."
};
// src/shared/i18n/index.ts
var dictionaries = {
	en,
	it: {
		"nav.focus": "Focus",
		"nav.tasks": "Attività",
		"nav.calendar": "Calendario",
		"nav.settings": "Impostazioni",
		"nav.zen": "Modalità Zen",
		"focus.title": "Focus attuale",
		"focus.start": "Avvia",
		"focus.resume": "Riprendi",
		"focus.pause": "Pausa",
		"focus.reset": "Azzera",
		"focus.complete": "Completa",
		"focus.addFive": "Aggiungi 5 minuti",
		"focus.clear": "Togli dal focus",
		"focus.zen": "Riduci a barra flottante",
		"focus.expand": "Apri FocusFlow",
		"focus.paused": "In pausa",
		"focus.running": "In corso",
		"focus.ready": "Pronto",
		"focus.timeUp": "Tempo scaduto",
		"focus.timeUpHint": "Segnala come completata oppure aggiungi 5 minuti e continua.",
		"focus.spent": "{time} finora",
		"focus.estimate": "{time} previsti",
		"focus.none": "Nessuna attività in focus",
		"focus.noneHint": "Scegli una sola attività. Il resto può aspettare.",
		"focus.noneEmpty": "Aggiungi la prima attività e comparirà qui.",
		"focus.upNext": "In arrivo",
		"focus.pick": "Scegli un'attività su cui concentrarti",
		"focus.breakOffer": "Fatto. Una pausa?",
		"focus.breakOfferHint": "{time} lontano dallo schermo, poi la prossima attività.",
		"focus.break": "Pausa",
		"focus.breakOver": "Pausa finita",
		"focus.startBreak": "Inizia la pausa",
		"focus.skipBreak": "Salta la pausa",
		"focus.endBreak": "Termina la pausa",
		"focus.now": "Focus ora",
		"focus.inFocus": "In focus",
		"tasks.title": "Attività",
		"tasks.new": "Nuova attività",
		"tasks.quickAdd": "Scrivi un'attività e premi Invio",
		"tasks.count": "{n} da fare",
		"tasks.all": "Tutte",
		"tasks.none": "Senza categoria",
		"tasks.done": "Completate",
		"tasks.empty": "Ancora nessuna attività",
		"tasks.emptyHint": "Scrivi un'attività qui sopra e premi Invio.",
		"tasks.emptyFilter": "Nessuna attività in questa categoria",
		"tasks.edit": "Modifica attività",
		"tasks.delete": "Elimina attività",
		"tasks.markDone": "Segna come completata",
		"tasks.markTodo": "Segna come da fare",
		"tasks.reorder": "Trascina per riordinare",
		"tasks.overdue": "In ritardo",
		"tasks.today": "Oggi",
		"tasks.tomorrow": "Domani",
		"field.title": "Titolo",
		"field.notes": "Note",
		"field.notesPlaceholder": "Dettagli, link, il primo passo…",
		"field.duration": "Tempo stimato",
		"field.custom": "Personalizzato",
		"field.minutes": "minuti",
		"field.priority": "Priorità",
		"field.category": "Categoria",
		"field.due": "Data",
		"field.tools": "Strumenti e risorse",
		"field.start": "Inizio",
		"tools.placeholder": "Aggiungi uno strumento o incolla un link, poi premi Invio",
		"tools.remove": "Rimuovi {name}",
		"tools.save": "Salva {name} nei tuoi strumenti",
		"tools.open": "Apri {name}",
		"tools.needed": "Cosa ti serve",
		"field.end": "Fine",
		"field.length": "Durata",
		"priority.high": "Alta",
		"priority.medium": "Media",
		"priority.low": "Bassa",
		"cal.title": "Calendario",
		"cal.today": "Oggi",
		"cal.day": "Giorno",
		"cal.week": "Settimana",
		"cal.month": "Mese",
		"cal.prev": "Precedente",
		"cal.next": "Successivo",
		"cal.backlog": "Da pianificare",
		"cal.backlogHint": "Trascina un'attività sul calendario per riservarle del tempo.",
		"cal.backlogEmpty": "Tutte le attività sono pianificate o completate.",
		"cal.newBlock": "Nuovo blocco di tempo",
		"cal.editBlock": "Modifica blocco di tempo",
		"cal.blockTitle": "A cosa serve questo tempo?",
		"cal.toTask": "Converti in attività",
		"cal.linked": "Collegato a un'attività",
		"cal.endBeforeStart": "L'ora di fine deve essere successiva all'ora di inizio.",
		"set.title": "Impostazioni",
		"set.appearance": "Aspetto",
		"set.theme": "Tema",
		"set.theme.dark": "Scuro",
		"set.theme.light": "Chiaro",
		"set.theme.system": "Come Windows",
		"set.accent": "Colore principale",
		"set.accentCustom": "Colore personalizzato",
		"set.language": "Lingua",
		"set.themeOverridden": "Il colore di sfondo personalizzato determina i colori del testo.",
		"set.background": "Sfondo",
		"set.bgHint": "I colori del testo si adattano automaticamente per restare leggibili.",
		"set.bgDefault": "Predefinito del tema",
		"set.bgCustom": "Personalizzato",
		"set.surface": "Schede e pannelli",
		"set.surfaceAuto": "Automatico",
		"set.surfaceCustom": "Colore delle schede personalizzato",
		"set.preview": "Anteprima",
		"set.previewTitle": "Scrivere il riepilogo del progetto",
		"set.previewBody": "Il testo secondario appare così.",
		"set.contrast.excellent": "Contrasto del testo {ratio}:1, leggibilissimo",
		"set.contrast.good": "Contrasto del testo {ratio}:1, ben leggibile",
		"set.contrast.low": "Contrasto del testo {ratio}:1, poco leggibile. Scegli un colore delle schede più chiaro o più scuro.",
		"bg.oled": "Nero puro",
		"bg.slate": "Ardesia",
		"bg.midnight": "Blu notte",
		"bg.forest": "Foresta notturna",
		"bg.paper": "Carta calda",
		"bg.gray": "Grigio tenue",
		"bg.white": "Bianco",
		"set.tools": "Strumenti e risorse",
		"set.toolsHint": "Compaiono come scelte rapide quando modifichi un'attività. Fai clic su un'icona per cambiarla.",
		"set.toolsEmpty": "Nessuno strumento. Aggiungine uno qui sotto o ripristina quelli predefiniti.",
		"set.toolName": "Nome",
		"set.toolUrl": "Link (facoltativo)",
		"set.toolAdd": "Nome o link di un nuovo strumento",
		"set.deleteTool": "Elimina {name}",
		"set.restoreTools": "Ripristina strumenti predefiniti",
		"set.toolIcon": "Cambia l'icona di {name}",
		"set.newToolIcon": "Icona del nuovo strumento",
		"icon.default": "Predefinita",
		"icon.emoji": "Emoji",
		"icon.image": "Immagine",
		"icon.emojiInput": "Scrivi o incolla un'emoji",
		"icon.emojiHint": "Premi Win + . per aprire il pannello emoji di Windows.",
		"icon.upload": "Scegli un'immagine…",
		"icon.replace": "Scegli un'altra immagine…",
		"icon.uploadHint": "PNG, JPG, SVG, WebP o ICO. Viene ridimensionata in un'icona quadrata.",
		"icon.uploadError": "Impossibile usare questo file come icona. Prova un PNG o JPG sotto i 5 MB.",
		"icon.defaultHint": "Usa l'icona predefinita di questo strumento.",
		"common.done": "Fatto",
		"set.timer": "Timer",
		"set.focusMin": "Sessione di focus predefinita",
		"set.focusMinHint": "Usata quando un'attività non ha una stima.",
		"set.breakMin": "Pausa predefinita",
		"set.behavior": "Windows",
		"set.startup": "Avvia all'accensione di Windows",
		"set.startupDev": "Ha effetto nell'app installata, non in modalità sviluppo.",
		"set.startMin": "Avvia ridotto nell'area di notifica",
		"set.startMinHint": "All'avvio resta nell'area di notifica finché non fai clic sull'icona.",
		"set.onTop": "Mantieni la finestra in primo piano",
		"set.sounds": "Suoni delle notifiche",
		"set.categories": "Categorie",
		"set.categoryName": "Nome della categoria",
		"set.addCategory": "Aggiungi categoria",
		"set.deleteCategory": "Elimina categoria",
		"set.newCategory": "Nuova categoria",
		"set.data": "I tuoi dati",
		"set.dataHint": "Salvati solo su questo computer.",
		"set.openFolder": "Apri cartella",
		"common.save": "Salva",
		"common.cancel": "Annulla",
		"common.delete": "Elimina",
		"common.close": "Chiudi",
		"common.add": "Aggiungi",
		"tray.show": "Apri FocusFlow",
		"tray.quit": "Esci",
		"tray.noFocus": "Nessuna attività in focus",
		"tray.left": "{time} rimanenti",
		"tray.hintTitle": "FocusFlow è ancora attivo",
		"tray.hintBody": "Resta nell'area di notifica. Fai clic destro sull'icona per uscire.",
		"notify.timeUpTitle": "Tempo scaduto",
		"notify.timeUpBody": "La sessione di focus per \"{task}\" è terminata.",
		"notify.breakOverTitle": "Pausa finita",
		"notify.breakOverBody": "Scegli la prossima attività.",
		"notify.soonTitle": "Inizia tra {n} min",
		"notify.soonBody": "{title} inizia alle {time}."
	}
};
function translator(language) {
	const dict = dictionaries[language] ?? en;
	return (key, vars) => {
		let text = dict[key] ?? en[key] ?? key;
		if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
		return text;
	};
}
// src/main/autostart.ts
var AUTOSTART_FLAG = "--autostart";
/**
* Register or remove the Windows login item (HKCU ...\Run).
* Skipped in development: it would register the bare electron.exe.
*/
function applyAutostart(enabled) {
	if (!electron.app.isPackaged) return;
	electron.app.setLoginItemSettings({
		openAtLogin: enabled,
		path: process.execPath,
		args: [AUTOSTART_FLAG]
	});
}
function launchedAtLogin() {
	return process.argv.includes(AUTOSTART_FLAG);
}
// src/shared/tools.ts
var TOOL_PRESETS = [
	{
		id: "vscode",
		label: "VS Code",
		url: "vscode://",
		color: "#2f8fe0"
	},
	{
		id: "netbeans",
		label: "NetBeans",
		url: null,
		color: "#1b6ac6"
	},
	{
		id: "terminal",
		label: "Terminal",
		url: null,
		color: "#8a93a6"
	},
	{
		id: "google",
		label: "Google",
		url: "https://www.google.com",
		color: "#4285f4",
		hosts: ["google.com"]
	},
	{
		id: "youtube",
		label: "YouTube",
		url: "https://www.youtube.com",
		color: "#ff3b30",
		hosts: ["youtube.com", "youtu.be"]
	},
	{
		id: "docs",
		label: "Google Docs",
		url: "https://docs.google.com",
		color: "#3b82f6",
		hosts: ["docs.google.com", "drive.google.com"]
	},
	{
		id: "figma",
		label: "Figma",
		url: "https://www.figma.com",
		color: "#a259ff",
		hosts: ["figma.com"]
	},
	{
		id: "github",
		label: "GitHub",
		url: "https://github.com",
		color: "#9aa4b8",
		hosts: ["github.com"]
	}
];
/** Library ids of the built-in tools are fixed so "Restore built-in tools" can find them. */
var presetLibraryId = (presetId) => `builtin-${presetId}`;
function defaultToolLibrary() {
	return TOOL_PRESETS.map((p) => ({
		id: presetLibraryId(p.id),
		label: p.label,
		url: p.url,
		preset: p.id,
		icon: null
	}));
}
/** First user-perceived character, so "👨‍💻" or "🇮🇹" stay whole. */
function firstGrapheme(text) {
	const trimmed = text.trim();
	if (!trimmed) return "";
	const Segmenter = Intl.Segmenter;
	if (Segmenter) for (const { segment } of new Segmenter(void 0, { granularity: "grapheme" }).segment(trimmed)) return segment;
	return Array.from(trimmed)[0] ?? "";
}
function sanitizeIcon(raw) {
	if (!raw || typeof raw !== "object") return null;
	const r = raw;
	if (r.type === "emoji" && typeof r.value === "string") {
		const value = firstGrapheme(r.value).slice(0, 16);
		return value ? {
			type: "emoji",
			value
		} : null;
	}
	if (r.type === "image" && typeof r.src === "string" && /^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.src) && r.src.length <= 48e3) return {
		type: "image",
		src: r.src
	};
	return null;
}
var ALLOWED_PROTOCOLS = [
	"http:",
	"https:",
	"vscode:",
	"mailto:"
];
function isSafeUrl(url) {
	try {
		return ALLOWED_PROTOCOLS.includes(new URL(url).protocol);
	} catch {
		return false;
	}
}
var presetById = (id) => id ? TOOL_PRESETS.find((p) => p.id === id) : void 0;
/** Library tools match by id; anything else by link, or by name when there is no link. */
function sameTool(a, b) {
	if (a.id && b.id) return a.id === b.id;
	if (a.url || b.url) return a.url === b.url && a.label.toLowerCase() === b.label.toLowerCase();
	return a.label.toLowerCase() === b.label.toLowerCase();
}
/** Copy the library's current details into a task's tool, keeping the link to it. */
function snapshotTool(ref, library) {
	const live = ref.id ? library.find((t) => t.id === ref.id) : void 0;
	return live ? { ...live } : ref;
}
function sanitizeTool(item) {
	if (!item || typeof item !== "object") return null;
	const r = item;
	const label = typeof r.label === "string" ? r.label.trim().slice(0, 60) : "";
	if (!label) return null;
	return {
		id: typeof r.id === "string" && r.id ? r.id.slice(0, 80) : null,
		label,
		url: typeof r.url === "string" && isSafeUrl(r.url) ? r.url : null,
		preset: typeof r.preset === "string" && presetById(r.preset) ? r.preset : null,
		icon: sanitizeIcon(r.icon)
	};
}
/** A task's tools: drop junk, unsafe links and duplicates. */
function sanitizeTools(raw, max = 20) {
	if (!Array.isArray(raw)) return [];
	const out = [];
	for (const item of raw) {
		const tool = sanitizeTool(item);
		if (tool && !out.some((t) => sameTool(t, tool))) out.push(tool);
		if (out.length >= max) break;
	}
	return out;
}
/** The tool library: every entry needs a unique id. */
function sanitizeLibrary(raw, max = 60) {
	if (!Array.isArray(raw)) return [];
	const out = [];
	for (const item of raw) {
		const tool = sanitizeTool(item);
		if (tool?.id && !out.some((t) => t.id === tool.id)) out.push(tool);
		if (out.length >= max) break;
	}
	return out;
}
var DEFAULT_SETTINGS = {
	launchAtStartup: true,
	startMinimized: false,
	alwaysOnTop: false,
	notificationSounds: true,
	theme: "dark",
	accent: [
		"#F0A63A",
		"#EF6F5E",
		"#E0569B",
		"#8B6CF0",
		"#4C8DF6",
		"#23B5A6",
		"#5DBB63"
	][0],
	bgColor: null,
	surfaceColor: null,
	language: "en",
	focusMin: 25,
	breakMin: 5
};
var DEFAULT_CATEGORIES = [
	{
		id: "cat-work",
		name: "Work",
		color: "#4C8DF6"
	},
	{
		id: "cat-study",
		name: "Study",
		color: "#8B6CF0"
	},
	{
		id: "cat-personal",
		name: "Personal",
		color: "#23B5A6"
	}
];
function idleFocus(minutes) {
	const ms = Math.round(minutes * 6e4);
	return {
		taskId: null,
		phase: "focus",
		status: "idle",
		durationMs: ms,
		remainingMs: ms,
		endsAt: null,
		runStartedAt: null
	};
}
function defaultData() {
	return {
		tasks: [],
		events: [],
		categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
		tools: defaultToolLibrary(),
		settings: { ...DEFAULT_SETTINGS },
		focus: idleFocus(DEFAULT_SETTINGS.focusMin)
	};
}
// src/shared/palette.ts
/** The built-in themes; keep in step with the :root blocks in the renderer stylesheet. */
var THEME_DEFAULTS = {
	dark: {
		tone: "dark",
		bg: "#161a24",
		rail: "#11141c",
		surface: "#1d2230",
		raised: "#262c3c",
		line: "#2e3547",
		ink: "#e9ecf3",
		muted: "#98a1b5",
		faint: "#6b748a"
	},
	light: {
		tone: "light",
		bg: "#eef1f6",
		rail: "#e3e7ef",
		surface: "#ffffff",
		raised: "#f1f4f8",
		line: "#d6dce7",
		ink: "#1a1f2b",
		muted: "#5a6478",
		faint: "#8a93a6"
	}
};
var isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
function rgb(hex) {
	return [
		1,
		3,
		5
	].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function toHex([r, g, b]) {
	return `#${[
		r,
		g,
		b
	].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}
/** Blend `a` toward `b` by `t` (0 = a, 1 = b). */
function mix(a, b, t) {
	const ca = rgb(a);
	const cb = rgb(b);
	return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}
function luminance(hex) {
	const [r, g, b] = rgb(hex).map((v) => {
		const c = v / 255;
		return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
	});
	return .2126 * r + .7152 * g + .0722 * b;
}
/** WCAG contrast ratio, 1..21. */
function contrast(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
}
var INK = {
	dark: "#eceff5",
	light: "#161a23"
};
/** Mix `ink` toward `bg` as far as possible while keeping at least `min` contrast. */
function softened(ink, bg, wanted, min) {
	for (let t = wanted; t > 0; t -= .05) {
		const c = mix(ink, bg, t);
		if (contrast(c, bg) >= min) return c;
	}
	return ink;
}
/** A full palette for a custom background (and optional custom surface). */
function customPalette(bg, surfaceChoice) {
	const tone = contrast(bg, "#ffffff") >= contrast(bg, "#000000") ? "dark" : "light";
	const surface = surfaceChoice ?? (tone === "dark" ? mix(bg, "#ffffff", .06) : mix(bg, "#ffffff", .65));
	const score = (ink) => Math.min(contrast(ink, bg), contrast(ink, surface));
	const ink = score(INK.dark) >= score(INK.light) ? INK.dark : INK.light;
	const harder = contrast(ink, bg) < contrast(ink, surface) ? bg : surface;
	return {
		tone: ink === INK.dark ? "dark" : "light",
		bg,
		rail: tone === "dark" ? mix(bg, "#000000", .25) : mix(bg, "#000000", .04),
		surface,
		raised: mix(surface, ink, .07),
		line: mix(surface, ink, .15),
		ink,
		muted: softened(ink, harder, .4, 4.5),
		faint: softened(ink, harder, .6, 3)
	};
}
/** The palette in effect, or null when the plain built-in theme applies. */
function resolvePalette(settings, systemDark) {
	if (!settings.bgColor && !settings.surfaceColor) return null;
	const themeTone = settings.theme === "system" ? systemDark ? "dark" : "light" : settings.theme;
	return customPalette(settings.bgColor ?? THEME_DEFAULTS[themeTone].bg, settings.surfaceColor);
}
/** Colours for the native window title bar (caption buttons). */
function windowChrome(settings, systemDark) {
	const custom = resolvePalette(settings, systemDark);
	if (custom) return {
		bg: custom.bg,
		symbol: custom.muted
	};
	const tone = settings.theme === "system" ? systemDark ? "dark" : "light" : settings.theme;
	return {
		bg: THEME_DEFAULTS[tone].bg,
		symbol: THEME_DEFAULTS[tone].muted
	};
}
// src/shared/time.ts
var MINUTE = 6e4;
/** Countdown text: "24:59", or "1:05:00" past an hour. Rounds up so 0:00 only shows at zero. */
function formatClock(ms) {
	const total = Math.max(0, Math.ceil(ms / 1e3));
	const h = Math.floor(total / 3600);
	const m = Math.floor(total % 3600 / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, "0");
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
	return `${String(m).padStart(2, "0")}:${ss}`;
}
function remainingMs(focus, now) {
	if (focus.status === "running" && focus.endsAt !== null) return Math.max(0, focus.endsAt - now);
	return Math.max(0, focus.remainingMs);
}
/** Local calendar day as YYYY-MM-DD. */
function toDateKey(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function eventMinutes(start, end) {
	return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / MINUTE));
}
// src/shared/model.ts
/**
* Pure state transitions. The main process applies these as the source of truth;
* renderers apply the same function optimistically so the UI responds instantly.
*/
function applyAction(data, action, now) {
	switch (action.type) {
		case "task/upsert": return upsertTask(data, action.task, now);
		case "task/remove": return removeTask(data, action.id, now);
		case "task/reorder": return reorderTasks(data, action.ids);
		case "task/setStatus": return setTaskStatus(data, action.id, action.status, now);
		case "event/upsert": return upsertEvent(data, action.event);
		case "event/remove": return {
			...data,
			events: data.events.filter((e) => e.id !== action.id)
		};
		case "event/toTask": return eventToTask(data, action.id, action.taskId, now);
		case "category/upsert": return upsertCategory(data, action.category);
		case "category/remove": return removeCategory(data, action.id);
		case "tool/upsert": return upsertLibraryTool(data, action.tool);
		case "tool/remove": return removeLibraryTool(data, action.id);
		case "tool/restoreDefaults": {
			const missing = defaultToolLibrary().filter((d) => !data.tools.some((t) => t.id === d.id));
			return missing.length ? {
				...data,
				tools: [...data.tools, ...missing]
			} : data;
		}
		case "settings/update": return updateSettings(data, action.patch);
		case "focus/set": return setFocus(data, action.taskId, now);
		case "focus/start": return startFocus(data, now);
		case "focus/pause": return pauseFocus(data, now);
		case "focus/reset": return resetFocus(data, now);
		case "focus/complete": return completeFocus(data, now);
		case "focus/extend": return extendFocus(data, action.minutes, now);
		case "focus/startBreak": return startBreak(data, now);
		case "focus/endBreak": return {
			...data,
			focus: idleFocus(data.settings.focusMin)
		};
		case "focus/tick": return tickFocus(data, now);
		default: return data;
	}
}
function clampMinutes(value, fallback, max = 1440) {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n) || n < 1) return fallback;
	return Math.min(n, max);
}
function upsertTask(data, draft, now) {
	const existing = data.tasks.find((t) => t.id === draft.id);
	if (existing) {
		const merged = {
			...existing,
			...draft,
			id: existing.id
		};
		merged.title = (merged.title ?? "").trim() || existing.title;
		merged.tools = draft.tools === void 0 ? existing.tools : taskTools(data, draft.tools);
		merged.estimateMin = clampMinutes(merged.estimateMin, existing.estimateMin);
		let focus = data.focus;
		if (focus.taskId === merged.id && focus.phase === "focus" && focus.status === "idle" && merged.estimateMin !== existing.estimateMin) {
			const ms = merged.estimateMin * MINUTE;
			focus = {
				...focus,
				durationMs: ms,
				remainingMs: ms
			};
		}
		return {
			...data,
			focus,
			tasks: data.tasks.map((t) => t.id === merged.id ? merged : t)
		};
	}
	const title = (draft.title ?? "").trim();
	if (!title) return data;
	const maxOrder = data.tasks.reduce((m, t) => Math.max(m, t.order), -1);
	const task = {
		id: draft.id,
		title,
		notes: draft.notes ?? "",
		tools: taskTools(data, draft.tools),
		estimateMin: clampMinutes(draft.estimateMin, data.settings.focusMin),
		priority: draft.priority ?? "medium",
		categoryId: draft.categoryId ?? null,
		dueDate: draft.dueDate ?? null,
		status: draft.status ?? "todo",
		order: draft.order ?? maxOrder + 1,
		spentMs: 0,
		createdAt: now,
		completedAt: null
	};
	return {
		...data,
		tasks: [...data.tasks, task]
	};
}
function removeTask(data, id, now) {
	let next = data;
	if (data.focus.taskId === id) next = {
		...settle(data, now),
		focus: idleFocus(data.settings.focusMin)
	};
	return {
		...next,
		tasks: next.tasks.filter((t) => t.id !== id),
		events: next.events.map((e) => e.taskId === id ? {
			...e,
			taskId: null
		} : e)
	};
}
/** `ids` is the new order of some or all tasks; unlisted tasks keep their relative order after them. */
function reorderTasks(data, ids) {
	const position = new Map(ids.map((id, i) => [id, i]));
	const sorted = [...data.tasks].sort((a, b) => {
		const pa = position.get(a.id);
		const pb = position.get(b.id);
		if (pa !== void 0 && pb !== void 0) return pa - pb;
		if (pa !== void 0) return -1;
		if (pb !== void 0) return 1;
		return a.order - b.order;
	});
	const order = new Map(sorted.map((t, i) => [t.id, i]));
	return {
		...data,
		tasks: data.tasks.map((t) => ({
			...t,
			order: order.get(t.id) ?? t.order
		}))
	};
}
function setTaskStatus(data, id, status, now) {
	const task = data.tasks.find((t) => t.id === id);
	if (!task || task.status === status) return data;
	let next = data;
	if (status === "done" && data.focus.taskId === id) next = {
		...settle(data, now),
		focus: idleFocus(data.settings.focusMin)
	};
	return {
		...next,
		tasks: next.tasks.map((t) => t.id === id ? {
			...t,
			status,
			completedAt: status === "done" ? now : null
		} : t)
	};
}
function upsertEvent(data, draft) {
	const existing = data.events.find((e) => e.id === draft.id);
	const base = existing ?? {
		id: draft.id,
		title: "",
		notes: "",
		start: "",
		end: "",
		categoryId: null,
		taskId: null
	};
	const merged = {
		...base,
		...draft,
		id: base.id
	};
	merged.title = (merged.title ?? "").trim() || existing?.title || "";
	const startMs = Date.parse(merged.start);
	if (!merged.title || Number.isNaN(startMs)) return data;
	let endMs = Date.parse(merged.end);
	if (Number.isNaN(endMs) || endMs <= startMs) endMs = startMs + 15 * MINUTE;
	merged.start = new Date(startMs).toISOString();
	merged.end = new Date(endMs).toISOString();
	let tasks = data.tasks;
	if (merged.taskId) {
		const day = toDateKey(new Date(startMs));
		const previousDay = existing ? toDateKey(new Date(existing.start)) : null;
		tasks = tasks.map((t) => t.id === merged.taskId && (!t.dueDate || t.dueDate === previousDay) && t.dueDate !== day ? {
			...t,
			dueDate: day
		} : t);
	}
	const events = existing ? data.events.map((e) => e.id === merged.id ? merged : e) : [...data.events, merged];
	return {
		...data,
		tasks,
		events
	};
}
function eventToTask(data, id, taskId, now) {
	const event = data.events.find((e) => e.id === id);
	if (!event || event.taskId) return data;
	const withTask = upsertTask(data, {
		id: taskId,
		title: event.title,
		notes: event.notes,
		estimateMin: eventMinutes(event.start, event.end),
		categoryId: event.categoryId,
		dueDate: toDateKey(new Date(event.start))
	}, now);
	return {
		...withTask,
		events: withTask.events.map((e) => e.id === id ? {
			...e,
			taskId
		} : e)
	};
}
/** Validate a task's tools and refresh linked ones from the library, so the snapshot is current. */
function taskTools(data, raw) {
	return sanitizeTools(raw).map((t) => snapshotTool(t, data.tools));
}
function upsertLibraryTool(data, raw) {
	const [tool] = sanitizeLibrary([raw]);
	if (!tool) return data;
	const exists = data.tools.some((t) => t.id === tool.id);
	return {
		...data,
		tools: exists ? data.tools.map((t) => t.id === tool.id ? tool : t) : [...data.tools, tool]
	};
}
/**
* Remove a tool from the library. Tasks that used it keep it as a plain,
* unlinked tool with its last name, link and icon, so nothing on them breaks.
*/
function removeLibraryTool(data, id) {
	const tool = data.tools.find((t) => t.id === id);
	if (!tool) return data;
	const detached = {
		...tool,
		id: null
	};
	return {
		...data,
		tools: data.tools.filter((t) => t.id !== id),
		tasks: data.tasks.map((task) => task.tools.some((t) => t.id === id) ? {
			...task,
			tools: task.tools.map((t) => t.id === id ? detached : t)
		} : task)
	};
}
function upsertCategory(data, category) {
	const exists = data.categories.some((c) => c.id === category.id);
	return {
		...data,
		categories: exists ? data.categories.map((c) => c.id === category.id ? {
			...c,
			...category
		} : c) : [...data.categories, category]
	};
}
function removeCategory(data, id) {
	return {
		...data,
		categories: data.categories.filter((c) => c.id !== id),
		tasks: data.tasks.map((t) => t.categoryId === id ? {
			...t,
			categoryId: null
		} : t),
		events: data.events.map((e) => e.categoryId === id ? {
			...e,
			categoryId: null
		} : e)
	};
}
function updateSettings(data, patch) {
	const settings = {
		...data.settings,
		...patch
	};
	settings.focusMin = clampMinutes(settings.focusMin, data.settings.focusMin, 600);
	settings.breakMin = clampMinutes(settings.breakMin, data.settings.breakMin, 120);
	if (settings.bgColor !== null && !isHex(settings.bgColor)) settings.bgColor = data.settings.bgColor;
	if (settings.surfaceColor !== null && !isHex(settings.surfaceColor)) settings.surfaceColor = data.settings.surfaceColor;
	if (!isHex(settings.accent)) settings.accent = data.settings.accent;
	let focus = data.focus;
	if (focus.status === "idle" && focus.taskId === null) {
		const minutes = focus.phase === "break" ? settings.breakMin : settings.focusMin;
		focus = {
			...focus,
			durationMs: minutes * MINUTE,
			remainingMs: minutes * MINUTE
		};
	}
	return {
		...data,
		settings,
		focus
	};
}
/** Credit the running stretch to the focused task and freeze the countdown. */
function settle(data, now) {
	const f = data.focus;
	if (f.status !== "running" || f.endsAt === null) return data;
	const remaining = Math.max(0, f.endsAt - now);
	const focus = {
		...f,
		status: "paused",
		remainingMs: remaining,
		endsAt: null,
		runStartedAt: null
	};
	if (f.phase !== "focus" || !f.taskId || f.runStartedAt === null) return {
		...data,
		focus
	};
	const worked = Math.max(0, Math.min(now, f.endsAt) - f.runStartedAt);
	return {
		...data,
		focus,
		tasks: data.tasks.map((t) => t.id === f.taskId ? {
			...t,
			spentMs: t.spentMs + worked
		} : t)
	};
}
function setFocus(data, taskId, now) {
	if (taskId === data.focus.taskId && data.focus.phase === "focus") return data;
	const settled = settle(data, now);
	if (taskId === null) return {
		...settled,
		focus: idleFocus(data.settings.focusMin)
	};
	const task = settled.tasks.find((t) => t.id === taskId);
	if (!task) return data;
	const tasks = task.status === "done" ? settled.tasks.map((t) => t.id === taskId ? {
		...t,
		status: "todo",
		completedAt: null
	} : t) : settled.tasks;
	return {
		...settled,
		tasks,
		focus: {
			...idleFocus(task.estimateMin),
			taskId
		}
	};
}
function startFocus(data, now) {
	const f = data.focus;
	if (f.status !== "idle" && f.status !== "paused") return data;
	if (f.phase === "focus" && !f.taskId) return data;
	if (f.remainingMs <= 0) return data;
	return {
		...data,
		focus: {
			...f,
			status: "running",
			endsAt: now + f.remainingMs,
			runStartedAt: now
		}
	};
}
function pauseFocus(data, now) {
	return data.focus.status === "running" ? settle(data, now) : data;
}
function resetFocus(data, now) {
	const settled = settle(data, now);
	const f = settled.focus;
	return {
		...settled,
		focus: {
			...f,
			status: "idle",
			remainingMs: f.durationMs,
			endsAt: null,
			runStartedAt: null
		}
	};
}
function completeFocus(data, now) {
	const taskId = data.focus.taskId;
	if (data.focus.phase !== "focus" || !taskId) return data;
	const settled = settle(data, now);
	return {
		...settled,
		tasks: settled.tasks.map((t) => t.id === taskId ? {
			...t,
			status: "done",
			completedAt: now
		} : t),
		focus: {
			...idleFocus(data.settings.breakMin),
			phase: "break"
		}
	};
}
function extendFocus(data, minutes, now) {
	const add = clampMinutes(minutes, 5, 240) * MINUTE;
	const f = data.focus;
	if (f.status === "running" && f.endsAt !== null) return {
		...data,
		focus: {
			...f,
			endsAt: f.endsAt + add,
			durationMs: f.durationMs + add
		}
	};
	if (f.status === "finished") return {
		...data,
		focus: {
			...f,
			status: "running",
			durationMs: f.durationMs + add,
			remainingMs: add,
			endsAt: now + add,
			runStartedAt: now
		}
	};
	return {
		...data,
		focus: {
			...f,
			durationMs: f.durationMs + add,
			remainingMs: f.remainingMs + add
		}
	};
}
function startBreak(data, now) {
	const settled = settle(data, now);
	const base = {
		...idleFocus(data.settings.breakMin),
		phase: "break"
	};
	return {
		...settled,
		focus: {
			...base,
			status: "running",
			endsAt: now + base.remainingMs,
			runStartedAt: now
		}
	};
}
function tickFocus(data, now) {
	const f = data.focus;
	if (f.status !== "running" || f.endsAt === null || now < f.endsAt) return data;
	const settled = settle(data, now);
	return {
		...settled,
		focus: {
			...settled.focus,
			status: "finished",
			remainingMs: 0
		}
	};
}
function focusedTask(data) {
	if (!data.focus.taskId) return null;
	return data.tasks.find((t) => t.id === data.focus.taskId) ?? null;
}
/**
* Events that should raise a "starting soon" reminder at `now`.
* `seen` holds keys already notified so a reminder fires once per event start time.
*/
function dueReminders(events, now, seen, leadMs = 5 * MINUTE) {
	const due = [];
	for (const e of events) {
		const start = Date.parse(e.start);
		if (Number.isNaN(start)) continue;
		const until = start - now;
		if (until <= 0 || until > leadMs) continue;
		const key = `${e.id}:${start}`;
		if (seen.has(key)) continue;
		seen.add(key);
		due.push(e);
	}
	return due;
}
// src/main/controller.ts
/**
* Owns the application state. Every change goes through `dispatch`, which
* applies it, queues a save, re-arms the focus timer and tells subscribers.
*/
var Controller = class {
	store;
	data;
	meta;
	source;
	listeners = /* @__PURE__ */ new Set();
	timer = null;
	constructor(store) {
		this.store = store;
		const loaded = store.load();
		this.data = loaded.data;
		this.meta = loaded.meta;
		this.source = loaded.source;
		if (loaded.source !== "file") this.store.save(this.data, this.meta);
	}
	dispatch(action) {
		const prev = this.data;
		const next = applyAction(prev, action, Date.now());
		if (next === prev) return;
		this.data = next;
		this.store.save(next, this.meta);
		this.arm();
		for (const listener of this.listeners) listener(next, prev);
	}
	updateMeta(change) {
		change(this.meta);
		this.store.save(this.data, this.meta);
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	flush() {
		this.store.flush();
	}
	dispose() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}
	/** Schedule the moment a running countdown reaches zero. */
	arm() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		const { status, endsAt } = this.data.focus;
		if (status !== "running" || endsAt === null) return;
		const wait = Math.max(0, endsAt - Date.now()) + 10;
		this.timer = setTimeout(() => this.dispatch({ type: "focus/tick" }), wait);
	}
};
// src/shared/types.ts
var IPC = {
	getState: "ff:get-state",
	getEnv: "ff:get-env",
	dispatch: "ff:dispatch",
	state: "ff:state",
	window: "ff:window",
	openExternal: "ff:open-external"
};
// resources/icon.ico?asset&asarUnpack
var icon_default$1 = (0, path.join)(__dirname, "../../resources/icon.ico").replace("app.asar", "app.asar.unpacked");
// src/main/windows.ts
var MINI = {
	width: 520,
	height: 76
};
var currentSettings = null;
var mainWindow = null;
var miniWindow = null;
var quitting = false;
var zen = false;
var onHideToTray = () => {};
var onZenChange = () => {};
/** Title bar colours: follow the custom background when one is set. */
var chrome = () => currentSettings ? windowChrome(currentSettings, electron.nativeTheme.shouldUseDarkColors) : electron.nativeTheme.shouldUseDarkColors ? {
	bg: "#161a24",
	symbol: "#98a1b5"
} : {
	bg: "#eef1f6",
	symbol: "#5a6478"
};
var alive = (win) => win !== null && !win.isDestroyed();
function markQuitting() {
	quitting = true;
}
function setHideToTrayHandler(handler) {
	onHideToTray = handler;
}
function webPreferences() {
	return {
		preload: (0, node_path.join)(__dirname, "../preload/index.js"),
		contextIsolation: true,
		nodeIntegration: false,
		sandbox: true
	};
}
function load(win, hash) {
	const devUrl = process.env["ELECTRON_RENDERER_URL"];
	if (!electron.app.isPackaged && devUrl) win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
	else win.loadFile((0, node_path.join)(__dirname, "../renderer/index.html"), hash ? { hash } : void 0);
}
function onScreen(x, y, width, height) {
	return electron.screen.getAllDisplays().some(({ workArea: a }) => {
		const overlapX = Math.min(x + width, a.x + a.width) - Math.max(x, a.x);
		const overlapY = Math.min(y + height, a.y + a.height) - Math.max(y, a.y);
		return overlapX >= 120 && overlapY >= 40;
	});
}
function lockNavigation(win) {
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:\/\//i.test(url)) electron.shell.openExternal(url);
		return { action: "deny" };
	});
	win.webContents.on("will-navigate", (event, url) => {
		const page = (u) => u.split("#")[0];
		if (page(url) !== page(win.webContents.getURL())) event.preventDefault();
	});
}
function createMainWindow(controller, show) {
	currentSettings = controller.data.settings;
	const saved = controller.meta.window.main;
	const usable = saved && onScreen(saved.x, saved.y, saved.width, saved.height) ? saved : void 0;
	const win = new electron.BrowserWindow({
		width: usable?.width ?? 1180,
		height: usable?.height ?? 760,
		x: usable?.x,
		y: usable?.y,
		minWidth: 940,
		minHeight: 620,
		show: false,
		title: "FocusFlow",
		icon: icon_default$1,
		backgroundColor: chrome().bg,
		autoHideMenuBar: true,
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: chrome().bg,
			symbolColor: chrome().symbol,
			height: 40
		},
		alwaysOnTop: controller.data.settings.alwaysOnTop,
		webPreferences: webPreferences()
	});
	mainWindow = win;
	lockNavigation(win);
	win.once("ready-to-show", () => {
		if (!show) return;
		if (usable?.maximized) win.maximize();
		win.show();
	});
	win.on("close", (event) => {
		if (quitting) return;
		event.preventDefault();
		win.hide();
		onHideToTray();
	});
	let saveTimer = null;
	const rememberBounds = () => {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			if (!alive(win) || win.isMinimized()) return;
			const b = win.getNormalBounds();
			controller.updateMeta((meta) => {
				meta.window.main = {
					...b,
					maximized: win.isMaximized()
				};
			});
		}, 400);
	};
	win.on("resize", rememberBounds);
	win.on("move", rememberBounds);
	win.on("closed", () => {
		if (saveTimer) clearTimeout(saveTimer);
		mainWindow = null;
	});
	load(win);
	return win;
}
function createMiniWindow(controller) {
	const saved = controller.meta.window.mini;
	const area = electron.screen.getPrimaryDisplay().workArea;
	const position = saved && onScreen(saved.x, saved.y, MINI.width, MINI.height) ? saved : {
		x: Math.round(area.x + (area.width - MINI.width) / 2),
		y: area.y + 28
	};
	const win = new electron.BrowserWindow({
		...MINI,
		...position,
		show: false,
		frame: false,
		transparent: true,
		resizable: false,
		maximizable: false,
		minimizable: false,
		fullscreenable: false,
		skipTaskbar: true,
		hasShadow: false,
		alwaysOnTop: true,
		title: "FocusFlow",
		icon: icon_default$1,
		webPreferences: webPreferences()
	});
	miniWindow = win;
	lockNavigation(win);
	win.setAlwaysOnTop(true, "screen-saver");
	win.once("ready-to-show", () => win.show());
	win.on("moved", () => {
		const [x, y] = win.getPosition();
		controller.updateMeta((meta) => {
			meta.window.mini = {
				x,
				y
			};
		});
	});
	win.on("close", (event) => {
		if (quitting) return;
		event.preventDefault();
		showMain();
	});
	win.on("closed", () => {
		miniWindow = null;
	});
	load(win, "mini");
	return win;
}
function isZen() {
	return zen;
}
function setZenListener(listener) {
	onZenChange = listener;
}
function setZen(value) {
	if (zen === value) return;
	zen = value;
	onZenChange();
}
function showMain() {
	if (alive(miniWindow)) miniWindow.hide();
	setZen(false);
	if (!alive(mainWindow)) return;
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.show();
	mainWindow.focus();
}
function toggleZen(controller) {
	if (zen) {
		showMain();
		return;
	}
	if (alive(miniWindow)) miniWindow.show();
	else createMiniWindow(controller);
	if (alive(mainWindow)) mainWindow.hide();
	setZen(true);
}
function broadcast(data) {
	for (const win of [mainWindow, miniWindow]) if (alive(win)) win.webContents.send(IPC.state, data);
}
/** Push theme and always-on-top settings onto the native window. */
function applyWindowSettings(data) {
	currentSettings = data.settings;
	electron.nativeTheme.themeSource = data.settings.theme;
	if (!alive(mainWindow)) return;
	mainWindow.setAlwaysOnTop(data.settings.alwaysOnTop);
	const { bg, symbol } = chrome();
	mainWindow.setBackgroundColor(bg);
	try {
		mainWindow.setTitleBarOverlay({
			color: bg,
			symbolColor: symbol,
			height: 40
		});
	} catch {}
}
// src/main/ipc.ts
function registerIpc(controller) {
	electron.ipcMain.handle(IPC.getState, () => controller.data);
	electron.ipcMain.handle(IPC.getEnv, () => ({
		packaged: electron.app.isPackaged,
		dataPath: electron.app.getPath("userData"),
		version: electron.app.getVersion()
	}));
	electron.ipcMain.handle(IPC.dispatch, (_event, action) => {
		if (!action || typeof action !== "object" || typeof action.type !== "string") return;
		controller.dispatch(action);
	});
	electron.ipcMain.on(IPC.openExternal, (_event, url) => {
		if (typeof url === "string" && isSafeUrl(url)) electron.shell.openExternal(url);
	});
	electron.ipcMain.on(IPC.window, (_event, command) => {
		switch (command) {
			case "toggle-zen":
				toggleZen(controller);
				break;
			case "show-main":
				showMain();
				break;
			case "open-data-folder":
				electron.shell.openPath(electron.app.getPath("userData"));
				break;
			case "quit":
				markQuitting();
				electron.app.quit();
		}
	});
}
// resources/icon.png?asset&asarUnpack
var icon_default = (0, path.join)(__dirname, "../../resources/icon.png").replace("app.asar", "app.asar.unpacked");
// src/main/notify.ts
var REMINDER_LEAD_MS = 5 * MINUTE;
var CHECK_EVERY_MS = 2e4;
var open = /* @__PURE__ */ new Set();
var reminded = /* @__PURE__ */ new Set();
function notify(data, title, body) {
	if (!electron.Notification.isSupported()) return;
	const toast = new electron.Notification({
		title,
		body,
		icon: icon_default,
		silent: !data.settings.notificationSounds
	});
	open.add(toast);
	toast.on("click", () => showMain());
	toast.on("close", () => open.delete(toast));
	toast.on("failed", () => open.delete(toast));
	toast.show();
}
function checkReminders(controller) {
	const data = controller.data;
	const now = Date.now();
	const t = translator(data.settings.language);
	const locale = data.settings.language === "it" ? "it-IT" : "en-US";
	for (const event of dueReminders(data.events, now, reminded, REMINDER_LEAD_MS)) {
		const start = new Date(event.start);
		notify(data, t("notify.soonTitle", { n: Math.max(1, Math.round((start.getTime() - now) / MINUTE)) }), t("notify.soonBody", {
			title: event.title,
			time: start.toLocaleTimeString(locale, {
				hour: "2-digit",
				minute: "2-digit"
			})
		}));
	}
}
function startNotifications(controller) {
	const unsubscribe = controller.subscribe((next, prev) => {
		if (prev.focus.status !== "running" || next.focus.status !== "finished") return;
		const t = translator(next.settings.language);
		if (next.focus.phase === "break") notify(next, t("notify.breakOverTitle"), t("notify.breakOverBody"));
		else {
			const task = next.tasks.find((x) => x.id === next.focus.taskId);
			notify(next, t("notify.timeUpTitle"), t("notify.timeUpBody", { task: task?.title ?? "" }));
		}
	});
	const interval = setInterval(() => checkReminders(controller), CHECK_EVERY_MS);
	checkReminders(controller);
	return () => {
		unsubscribe();
		clearInterval(interval);
	};
}
var defaultMeta = () => ({
	window: {},
	trayHintShown: false
});
/**
* A single JSON document on disk, written atomically (temp file + rename) so a
* crash mid-write can never leave a half-written file. A backup of the last
* file that loaded cleanly is kept alongside it.
*/
var JsonStore = class {
	dir;
	debounceMs;
	file;
	backup;
	tmp;
	pending = null;
	timer = null;
	constructor(dir, debounceMs = 250) {
		this.dir = dir;
		this.debounceMs = debounceMs;
		this.file = node_path.default.join(dir, "data.json");
		this.backup = node_path.default.join(dir, "data.bak.json");
		this.tmp = node_path.default.join(dir, "data.json.tmp");
	}
	load(now = Date.now()) {
		node_fs.default.mkdirSync(this.dir, { recursive: true });
		const main = this.read(this.file);
		if (main) {
			try {
				node_fs.default.copyFileSync(this.file, this.backup);
			} catch {}
			return {
				...normalize(main, now),
				source: "file"
			};
		}
		if (node_fs.default.existsSync(this.file)) try {
			node_fs.default.renameSync(this.file, node_path.default.join(this.dir, `data.corrupt-${now}.json`));
		} catch {}
		const backup = this.read(this.backup);
		if (backup) return {
			...normalize(backup, now),
			source: "backup"
		};
		return {
			data: defaultData(),
			meta: defaultMeta(),
			source: "fresh"
		};
	}
	/** Queue a write; rapid changes collapse into one. */
	save(data, meta) {
		this.pending = {
			schemaVersion: 1,
			savedAt: Date.now(),
			data,
			meta
		};
		if (this.timer) return;
		this.timer = setTimeout(() => this.flush(), this.debounceMs);
	}
	/** Write any queued state right now. */
	flush() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (!this.pending) return;
		const payload = this.pending;
		this.pending = null;
		payload.savedAt = Date.now();
		node_fs.default.mkdirSync(this.dir, { recursive: true });
		node_fs.default.writeFileSync(this.tmp, JSON.stringify(payload, null, 2), "utf8");
		node_fs.default.renameSync(this.tmp, this.file);
	}
	read(file) {
		try {
			const parsed = JSON.parse(node_fs.default.readFileSync(file, "utf8"));
			return parsed && typeof parsed === "object" ? parsed : null;
		} catch {
			return null;
		}
	}
};
var isDict = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v, fallback) => typeof v === "string" ? v : fallback;
var num = (v, fallback) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
var bool = (v, fallback) => typeof v === "boolean" ? v : fallback;
var strOrNull = (v) => typeof v === "string" && v ? v : null;
var oneOf = (v, options, fallback) => options.includes(v) ? v : fallback;
var list = (v) => Array.isArray(v) ? v.filter(isDict) : [];
function normalize(raw, now) {
	const root = isDict(raw) ? raw : {};
	const d = isDict(root.data) ? root.data : {};
	const savedAt = num(root.savedAt, now);
	const s = isDict(d.settings) ? d.settings : {};
	const settings = {
		launchAtStartup: bool(s.launchAtStartup, DEFAULT_SETTINGS.launchAtStartup),
		startMinimized: bool(s.startMinimized, DEFAULT_SETTINGS.startMinimized),
		alwaysOnTop: bool(s.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop),
		notificationSounds: bool(s.notificationSounds, DEFAULT_SETTINGS.notificationSounds),
		theme: oneOf(s.theme, [
			"dark",
			"light",
			"system"
		], DEFAULT_SETTINGS.theme),
		accent: isHex(s.accent) ? s.accent : DEFAULT_SETTINGS.accent,
		bgColor: isHex(s.bgColor) ? s.bgColor : null,
		surfaceColor: isHex(s.surfaceColor) ? s.surfaceColor : null,
		language: oneOf(s.language, ["en", "it"], DEFAULT_SETTINGS.language),
		focusMin: Math.min(600, Math.max(1, Math.round(num(s.focusMin, DEFAULT_SETTINGS.focusMin)))),
		breakMin: Math.min(120, Math.max(1, Math.round(num(s.breakMin, DEFAULT_SETTINGS.breakMin))))
	};
	const categories = Array.isArray(d.categories) ? list(d.categories).filter((c) => typeof c.id === "string" && c.id).map((c) => ({
		id: c.id,
		name: str(c.name, ""),
		color: str(c.color, "#8A93A6")
	})) : defaultData().categories;
	const library = loadLibrary(d, s);
	const categoryIds = new Set(categories.map((c) => c.id));
	const category = (v) => typeof v === "string" && categoryIds.has(v) ? v : null;
	const tasks = list(d.tasks).filter((t) => typeof t.id === "string" && t.id && typeof t.title === "string" && t.title.trim()).map((t, i) => ({
		id: t.id,
		title: t.title.trim(),
		notes: str(t.notes, ""),
		tools: linkTools(sanitizeTools(t.tools), library),
		estimateMin: Math.max(1, Math.round(num(t.estimateMin, settings.focusMin))),
		priority: oneOf(t.priority, [
			"high",
			"medium",
			"low"
		], "medium"),
		categoryId: category(t.categoryId),
		dueDate: /^\d{4}-\d{2}-\d{2}$/.test(str(t.dueDate, "")) ? t.dueDate : null,
		status: oneOf(t.status, ["todo", "done"], "todo"),
		order: num(t.order, i),
		spentMs: Math.max(0, num(t.spentMs, 0)),
		createdAt: num(t.createdAt, now),
		completedAt: typeof t.completedAt === "number" ? t.completedAt : null
	}));
	const taskIds = new Set(tasks.map((t) => t.id));
	const data = {
		tasks,
		events: list(d.events).filter((e) => typeof e.id === "string" && e.id && !Number.isNaN(Date.parse(str(e.start, ""))) && Date.parse(str(e.end, "")) > Date.parse(str(e.start, ""))).map((e) => ({
			id: e.id,
			title: str(e.title, "").trim() || "Untitled",
			notes: str(e.notes, ""),
			start: new Date(Date.parse(e.start)).toISOString(),
			end: new Date(Date.parse(e.end)).toISOString(),
			categoryId: category(e.categoryId),
			taskId: typeof e.taskId === "string" && taskIds.has(e.taskId) ? e.taskId : null
		})),
		categories,
		tools: library,
		settings,
		focus: normalizeFocus(d.focus, settings, taskIds, savedAt)
	};
	const m = isDict(root.meta) ? root.meta : {};
	const w = isDict(m.window) ? m.window : {};
	const meta = {
		window: {},
		trayHintShown: bool(m.trayHintShown, false)
	};
	if (isDict(w.main) && [
		"x",
		"y",
		"width",
		"height"
	].every((k) => typeof w.main[k] === "number")) {
		const b = w.main;
		meta.window.main = {
			x: b.x,
			y: b.y,
			width: b.width,
			height: b.height,
			maximized: bool(b.maximized, false)
		};
	}
	if (isDict(w.mini) && typeof w.mini.x === "number" && typeof w.mini.y === "number") meta.window.mini = {
		x: w.mini.x,
		y: w.mini.y
	};
	return {
		data,
		meta
	};
}
function normalizeFocus(raw, settings, taskIds, savedAt) {
	if (!isDict(raw)) return idleFocus(settings.focusMin);
	const phase = oneOf(raw.phase, ["focus", "break"], "focus");
	const taskId = strOrNull(raw.taskId);
	if (phase === "focus" && (!taskId || !taskIds.has(taskId))) return idleFocus(settings.focusMin);
	const fallback = (phase === "break" ? settings.breakMin : settings.focusMin) * 6e4;
	const durationMs = Math.max(1e3, num(raw.durationMs, fallback));
	let status = oneOf(raw.status, [
		"idle",
		"running",
		"paused",
		"finished"
	], "idle");
	let remaining = Math.min(durationMs, Math.max(0, num(raw.remainingMs, durationMs)));
	if (status === "running") {
		const endsAt = num(raw.endsAt, savedAt);
		remaining = Math.min(durationMs, Math.max(0, endsAt - savedAt));
		status = remaining > 0 ? "paused" : "finished";
	}
	return {
		taskId: phase === "focus" ? taskId : null,
		phase,
		status,
		durationMs,
		remainingMs: status === "idle" ? durationMs : remaining,
		endsAt: null,
		runStartedAt: null
	};
}
/**
* The tool library. Files from before it existed get the built-in tools plus any
* tools saved under the old "savedTools" setting.
*/
function loadLibrary(d, s) {
	if (Array.isArray(d.tools)) return sanitizeLibrary(d.tools);
	const library = defaultToolLibrary();
	for (const legacy of sanitizeTools(s.savedTools, 40)) if (!library.some((t) => sameTool({
		...t,
		id: null
	}, legacy))) library.push({
		...legacy,
		id: (0, node_crypto.randomUUID)()
	});
	return library;
}
/** Older task tools had no library id: link them to a matching library tool so Settings edits reach them. */
function linkTools(tools, library) {
	return tools.map((t) => {
		if (t.id) return t;
		const match = library.find((l) => sameTool({
			...l,
			id: null
		}, t));
		return match ? {
			...t,
			id: match.id
		} : t;
	});
}
// src/main/tray.ts
var tray = null;
var ticker = null;
var clip = (text, max) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
/** One line describing what is in focus, for the tooltip and the menu header. */
function focusLine(data) {
	const t = translator(data.settings.language);
	const { focus } = data;
	const left = formatClock(remainingMs(focus, Date.now()));
	if (focus.phase === "break") {
		if (focus.status === "running") return `${t("focus.break")} · ${t("tray.left", { time: left })}`;
		if (focus.status === "finished") return t("focus.breakOver");
		return t("tray.noFocus");
	}
	const task = focusedTask(data);
	if (!task) return t("tray.noFocus");
	const title = clip(task.title, 60);
	if (focus.status === "finished") return `${title} · ${t("focus.timeUp")}`;
	if (focus.status === "paused") return `${title} · ${t("focus.paused")} · ${left}`;
	return `${title} · ${t("tray.left", { time: left })}`;
}
function refreshTooltip(controller) {
	tray?.setToolTip(clip(`FocusFlow\n${focusLine(controller.data)}`, 127));
}
function refreshMenu(controller) {
	if (!tray) return;
	const data = controller.data;
	const t = translator(data.settings.language);
	const { focus } = data;
	const hasTask = focus.phase === "focus" && focus.taskId !== null;
	const running = focus.status === "running";
	const items = [
		{
			label: clip(focusLine(data), 80),
			enabled: false
		},
		{ type: "separator" },
		{
			label: t("tray.show"),
			click: () => showMain()
		}
	];
	if (hasTask && focus.status !== "finished") items.push({
		label: running ? t("focus.pause") : focus.status === "paused" ? t("focus.resume") : t("focus.start"),
		click: () => controller.dispatch({ type: running ? "focus/pause" : "focus/start" })
	});
	if (hasTask) items.push({
		label: t("focus.complete"),
		click: () => controller.dispatch({ type: "focus/complete" })
	});
	items.push({
		label: t("nav.zen"),
		type: "checkbox",
		checked: isZen(),
		click: () => toggleZen(controller)
	}, { type: "separator" }, {
		label: t("tray.quit"),
		click: () => {
			markQuitting();
			electron.app.quit();
		}
	});
	tray.setContextMenu(electron.Menu.buildFromTemplate(items));
}
function createTray(controller) {
	tray = new electron.Tray(icon_default$1);
	tray.on("click", () => showMain());
	const refresh = () => {
		refreshTooltip(controller);
		refreshMenu(controller);
		const running = controller.data.focus.status === "running";
		if (running && !ticker) ticker = setInterval(() => refreshTooltip(controller), 1e3);
		if (!running && ticker) {
			clearInterval(ticker);
			ticker = null;
		}
	};
	controller.subscribe(refresh);
	setZenListener(() => refreshMenu(controller));
	refresh();
}
function destroyTray() {
	if (ticker) clearInterval(ticker);
	ticker = null;
	tray?.destroy();
	tray = null;
}
// src/main/index.ts
var APP_ID = "com.focusflow.app";
electron.app.setName("FocusFlow");
electron.app.setPath("userData", process.env["FOCUSFLOW_DATA_DIR"] || (0, node_path.join)(electron.app.getPath("appData"), "FocusFlow"));
if (!electron.app.requestSingleInstanceLock()) electron.app.quit();
else {
	electron.app.on("second-instance", () => showMain());
	electron.app.whenReady().then(() => {
		electron.app.setAppUserModelId(electron.app.isPackaged ? APP_ID : process.execPath);
		const controller = new Controller(new JsonStore(electron.app.getPath("userData")));
		electron.nativeTheme.themeSource = controller.data.settings.theme;
		registerIpc(controller);
		controller.subscribe((next, prev) => {
			broadcast(next);
			if (next.settings !== prev.settings) {
				applyWindowSettings(next);
				if (next.settings.launchAtStartup !== prev.settings.launchAtStartup) applyAutostart(next.settings.launchAtStartup);
			}
		});
		electron.nativeTheme.on("updated", () => applyWindowSettings(controller.data));
		setHideToTrayHandler(() => {
			if (controller.meta.trayHintShown) return;
			controller.updateMeta((meta) => {
				meta.trayHintShown = true;
			});
			const t = translator(controller.data.settings.language);
			notify(controller.data, t("tray.hintTitle"), t("tray.hintBody"));
		});
		createMainWindow(controller, !(launchedAtLogin() && controller.data.settings.startMinimized));
		createTray(controller);
		const stopNotifications = startNotifications(controller);
		applyAutostart(controller.data.settings.launchAtStartup);
		electron.powerMonitor.on("resume", () => controller.dispatch({ type: "focus/tick" }));
		electron.app.on("before-quit", () => {
			markQuitting();
			stopNotifications();
			controller.dispatch({ type: "focus/pause" });
			controller.dispose();
			controller.flush();
			destroyTray();
		});
	});
	electron.app.on("window-all-closed", () => {});
}
