// TODO: note optionally next to message
// TODO: check xnote version setting
// TODO: rename xnote, qnote API
var Prefs;
var CurrentNote;
var CurrentTab;

async function focusMessagePane(){
	return browser.windows.getCurrent().then(async window => {
		await browser.windows.update(window.id, {
			focused: true
		});

		// browser.windows.update() will focus main window, but not message list
		await browser.qapp.messagesFocus();
	});
}

function initCurrentNote(){
	if(Prefs.windowOption === 'xul'){
		CurrentNote = new XULNoteWindow();
	} else if(Prefs.windowOption == 'webext'){
		CurrentNote = new WebExtensionNoteWindow();
	}

	CurrentNote.onAfterDelete = note => {
		console.debug("CurrentNote.onAfterDelete", note);
		if(Prefs.useTag){
			tagMessage(note.keyId, false);
		}
		updateDisplayedMessage(CurrentTab);
	}

	CurrentNote.onAfterSave = note => {
		console.debug("CurrentNote.onAfterSave", note);
		if(Prefs.useTag){
			tagMessage(note.keyId, true);
		}
		updateDisplayedMessage(CurrentTab);
	}
}

async function initExtension(){
	console.debug("initExtension()");
	Prefs = await loadPrefsWithDefaults();

	initCurrentNote();

	await browser.qapp.init();

	// Context menu on message
	browser.menus.onShown.addListener(info => {
		// Avoid context menu other than from messageList
		if(info.selectedMessages === undefined){
			return;
		}

		browser.menus.removeAll();

		if(info.selectedMessages.messages.length != 1){
			return;
		}

		createNoteForMessage(Menu.getId(info)).then((note)=>{
			note.load().then(async (data)=>{
				Menu[data?"modify":"new"]();
				await browser.menus.refresh();
			});
		});
	});

	// Change folders
	browser.mailTabs.onDisplayedFolderChanged.addListener(async (tab, displayedFolder) => {
		console.debug("browser.mailTabs.onDisplayedFolderChanged()");
		await CurrentNote.close();
		updateDisplayedMessage(CurrentTab);
	});

	// Change tabs
	browser.tabs.onActivated.addListener(async activeInfo => {
		CurrentTab = activeInfo.tabId;
		console.debug("browser.tabs.onActivated()", activeInfo);
		await CurrentNote.close();
		updateDisplayedMessage(CurrentTab);
	});

	// Handle keyboard shortcuts
	browser.commands.onCommand.addListener(command => {
		if(command === 'qnote') {
			QNoteTabPopToggle().then(()=>{
				QNoteTabPop(CurrentTab, true, true, true);
			});
		}
	});

	// Click on main window toolbar
	browser.browserAction.onClicked.addListener(tab => {
		console.debug("browser.browserAction.onClicked()");
		//QNoteTabPop(tab);
		QNoteTabPopToggle().then(()=>{
			QNoteTabPop(tab);
		});
	});

	// Click on QNote button
	browser.messageDisplayAction.onClicked.addListener(tab => {
		console.debug("browser.messageDisplayAction.onClicked()");
		QNoteTabPopToggle().then(()=>{
			QNoteTabPop(tab);
		});
		//QNoteTabPop(tab);
	});

	// Change message
	browser.messageDisplay.onMessageDisplayed.addListener((tab, message) => {
		console.debug("browser.messageDisplay.onMessageDisplayed()");
		QNoteTabPop(tab, false, Prefs.showOnSelect, false);
		updateDisplayedMessage(CurrentTab);
	});

	browser.qapp.updateView();
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
