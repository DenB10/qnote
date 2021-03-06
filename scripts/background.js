// MAYBE: multiple notes simultaneously
// TODO: save note pos and dims locally, outside note
// TODO: structure app code separately
var Prefs;
var CurrentNote;
var CurrentTabId;
var CurrentWindowId;
var QDEB = true;
var i18n = new DOMLocalizator(browser.i18n.getMessage);

async function focusMessagePane(windowId){
	browser.qapp.messagePaneFocus(windowId);
}

function initCurrentNote(){
	updateIcons(false);
	if(CurrentNote){
		CurrentNote.needSaveOnClose = true;
		CurrentNote.windowId = CurrentWindowId;
		return;
	}

	if(Prefs.windowOption === 'xul'){
		CurrentNote = new XULNoteWindow(CurrentWindowId);
	} else if(Prefs.windowOption == 'webext'){
		CurrentNote = new WebExtensionNoteWindow(CurrentWindowId);
	} else {
		throw new TypeError("Prefs.windowOption");
	}

	browser.qpopup.onControls.addListener(async (action, id, pi) => {
		if(id !== 'note-delete' || action !== 'click' || pi.id != CurrentNote.popupId){
			return;
		}

		if(await confirmDelete()) {
			CurrentNote.needSaveOnClose = false;
			CurrentNote.close().then(() => {
				return CurrentNote.deleteNote();
			}).then(()=>{
				initCurrentNote();
			});
		}
	});

	CurrentNote.addListener("afterupdate", (NoteWindow, action, isOk) => {
		QDEB&&console.debug("afterupdate", action, isOk);
		if(isOk && CurrentNote.messageId){
			mpUpdateForMessage(CurrentNote.messageId);
			if(Prefs.useTag){
				tagMessage(CurrentNote.messageId, Prefs.tagName, action === "save");
			}
		}
	});

	CurrentNote.addListener("afterclose", (NoteWindow, isClosed) => {
		if(isClosed){
			focusMessagePane(CurrentNote.windowId);
		}
	});
}

async function initExtension(){
	QDEB&&console.debug("initExtension()");

	Prefs = await loadPrefsWithDefaults();

	QDEB = !!Prefs.enableDebug;

	browser.qapp.setDebug(QDEB);

	CurrentWindowId = await getCurrentWindowId();

	// Return notes to qapp on request
	browser.qapp.onNoteRequest.addListener(getQAppNoteData);

	browser.qapp.enablePrintAttacher({
		topTitle: Prefs.printAttachTopTitle,
		topText: Prefs.printAttachTopText,
		bottomTitle: Prefs.printAttachBottomTitle,
		bottomText: Prefs.printAttachBottomText,
		dateFormat: Prefs.dateFormat
	});

	// window.addEventListener("unhandledrejection", event => {
	// 	console.warn(`Unhandle: ${event.reason}`, event);
	// });

	initCurrentNote();

	await browser.qapp.init();

	browser.qapp.setColumnTextLimit(Prefs.showFirstChars);

	// KeyDown from qapp
	browser.qapp.onKeyDown.addListener(e => {
		let ret = {};
		if(e.key === 'Escape'){
			if(CurrentNote.shown){
				CurrentNote.needSaveOnClose = false;
				CurrentNote.close();
				ret.preventDefault = true;
			}
		}
		return ret;
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener(async (Tab, displayedFolder) => {
		QDEB&&console.debug("mailTabs.onDisplayedFolderChanged()");
		await CurrentNote.close();

		// CurrentTabId = getTabId(Tab);
		// CurrentWindowId = Tab.windowId;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Create tabs
	browser.tabs.onCreated.addListener(async Tab => {
		QDEB&&console.debug("tabs.onCreated()", Tab);
		await CurrentNote.close();

		// CurrentTabId = activeInfo.tabId;
		// CurrentWindowId = activeInfo.windowId;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		QDEB&&console.debug("tabs.onActivated()", activeInfo);
		await CurrentNote.close();

		CurrentTabId = activeInfo.tabId;
		// CurrentWindowId = activeInfo.windowId;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Create window
	browser.windows.onCreated.addListener(async Window => {
		QDEB&&console.debug("windows.onCreated()");
		await CurrentNote.close();

		CurrentWindowId = Window.id;
		initCurrentNote();
		//updateCurrentMessage(CurrentTab);
	});

	// Change focus
	browser.windows.onFocusChanged.addListener(async windowId => {
		QDEB&&console.debug("windows.onFocusChanged(), windowId:", windowId, ", current windowId:", CurrentNote.windowId);
		if(
			windowId === browser.windows.WINDOW_ID_NONE ||
			windowId === CurrentNote.windowId
		){
			return;
		}

		QDEB&&console.debug("windows.onFocusChanged()", windowId, CurrentNote.windowId);
		await CurrentNote.close();

		CurrentWindowId = windowId;
		initCurrentNote();
		mpUpdateCurrent();
	});

	// Change message
	browser.messageDisplay.onMessageDisplayed.addListener(async (Tab, Message) => {
		QDEB&&console.debug("messageDisplay.onMessageDisplayed(), messageId:", Message.id);
		//updateCurrentMessage(CurrentTab);

		await CurrentNote.close();

		CurrentTabId = getTabId(Tab);
		// CurrentWindowId = Tab.windowId;
		// CurrentWindowId = await getCurrentWindowId();
		initCurrentNote();

		let flags = POP_EXISTING;
		if(Prefs.focusOnDisplay){
			flags |= POP_FOCUS;
		}

		if(Prefs.showOnSelect){
			QNotePopForMessage(Message.id, flags).then(isPopped =>{
				// Focus message pane in case popped
				if(isPopped && !Prefs.focusOnDisplay){
					focusMessagePane(CurrentNote.windowId);
				}
			});
		}
		mpUpdateForMessage(Message.id);
	});

	// Click on main toolbar
	browser.browserAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("browserAction.onClicked()");
		QNotePopToggle(Tab || CurrentTabId);
		// QNotePopToggle().then(()=>{
		// 	QNoteTabPop(tab);
		// });
		// CurrentTab = tab;
	});

	// // Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(Tab => {
		QDEB&&console.debug("messageDisplayAction.onClicked()", Tab, CurrentTabId);
		QNotePopToggle(Tab || CurrentTabId);
		// QNotePopToggle().then(()=>{
		// 	QNoteTabPop(tab);
		// });
		// CurrentTab = tab;
	});

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener(command => {
		if(command === 'qnote') {
			QDEB&&console.debug("commands.onCommand()", command);
			QNotePopToggle(CurrentTabId);
		}
	});

	// Context menu on message
	browser.menus.onShown.addListener(info => {
		// Avoid context menu other than from messageList
		// TODO: menu delete all notes from selected messages?
		if(info.selectedMessages === undefined){
			return;
		}

		browser.menus.removeAll();

		if(info.selectedMessages.messages.length != 1){
			return;
		}

		loadNoteForMessage(Menu.getId(info)).then(note => {
			Menu[note.exists ? "modify" : "new"]();
			browser.menus.refresh();
		});
	});

}

async function waitForLoad() {
	let windows = await browser.windows.getAll({windowTypes:["normal"]});
	if (windows.length > 0) {
		return false;
	}

	return new Promise(function(resolve, reject) {
		function listener() {
			browser.windows.onCreated.removeListener(listener);
			resolve(true);
		}
		browser.windows.onCreated.addListener(listener);
	});
}

waitForLoad().then(isAppStartup => initExtension());
