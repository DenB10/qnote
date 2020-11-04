var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("qnote@dqdp.net");

var EXPORTED_SYMBOLS = ["ColumnHandler"];

var ColumnHandler;

{

let noteGrabber;

class QNoteColumnHandler {
	constructor(folder) {
		//console.log("new QNoteColumnHandler", noteGrabber.listeners.noterequest);
		//this.window = window;
		this.folder = folder;
		this.window = folder.msgWindow.domWindow;
		this.view = folder.view.dbView;
		//this.view = window.gDBView;
		this.setUpDOM();

		let self = this;
		let noteListener = (keyId, data, params) => {
			if(self.view && params && params.row){
				// Asynchronically here we update note column.
				// That method is part of Mozilla API and has nothing to do with either XNote or QNote :)
				self.view.NoteChange(params.row, 1, 2);
			}
		}

		// TODO: remove listener
		//noteGrabber.addListener("noterequest", this.noteListener);
		noteGrabber.addListener("noterequest", noteListener);
		this.destroy = () => {
			noteGrabber.removeListener("noterequest", noteListener);
		}
		//element.addEventListener('click', this.onclick2.bind(this), false); // Trick
	}

	setUpDOM() {
		try {
			let cssService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
			let uri = Services.io.newURI(extension.getURL("html/background.css"), null, null);
			if(!cssService.sheetRegistered(uri, cssService.USER_SHEET)){
				cssService.loadAndRegisterSheet(uri, cssService.USER_SHEET);
			}
		} catch(e) {
			console.error(e);
		}

		let w = this.window;
		let threadCols = w.document.getElementById("threadCols");
		let qnoteCol = w.document.getElementById("qnoteCol");

		//if(!qnoteCol && threadCols){
		if(qnoteCol || !threadCols){
			return;
		}

		// http://wbamberg.github.io/idl-reference/docs/nsIXULStore.html
		let width = 24;
		let ordinal;
		let colOrdinalStr = '';
		let splitOrdinalStr = '';

		let __xulStore = Cc["@mozilla.org/xul/xulstore;1"].getService(Ci.nsIXULStore);

		if(__xulStore.hasValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "width")){
			width = Number.parseInt(__xulStore.getValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "width"));
		}

		if(__xulStore.hasValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "ordinal")){
			ordinal = Number.parseInt(__xulStore.getValue("chrome://messenger/content/messenger.xhtml", "qnoteCol", "ordinal"));
		}

		// let cStates = w.gFolderDisplay.getColumnStates();

		// console.log("view1", cStates.qnoteCol);

		// if(cStates.qnoteCol === undefined){
		// 	cStates.qnoteCol = {
		// 		width: width,
		// 		visible: true
		// 	};
		// 	if(ordinal){
		// 		cStates.qnoteCol.ordinal = ordinal
		// 	}
		// } else {
		// 	if(cStates.qnoteCol.width){
		// 		width = Number.parseInt(cStates.qnoteCol.width);
		// 	}
		// 	if(cStates.qnoteCol.ordinal){
		// 		ordinal = Number.parseInt(cStates.qnoteCol.ordinal);
		// 	}
		// 	//let { width, ordinal } = cStates.qnoteCol;
		// }

		if(ordinal){
			// colOrdinalStr = `ordinal="${ordinal}" style="-moz-box-ordinal-group: ${ordinal};"`;
			// splitOrdinalStr = `style="-moz-box-ordinal-group: ${(ordinal - 1)};"`;
		}
		//console.log("ordinals", ordinal, colOrdinalStr, splitOrdinalStr);

		let html = `<splitter class="tree-splitter" resizeafter="farthest" ${splitOrdinalStr} />
			<treecol id="qnoteCol" persist="hidden ordinal width sortDirection" width="${width}" ${colOrdinalStr}
			label="QNote" minwidth="19" tooltiptext="QNote" currentView="unthreaded"
			is="treecol-image" class="treecol-image qnote-column-header"/>`
		;

		// '<label class="treecol-text" crop="right" value="QNote" />' +
		// '<image class="treecol-sortdirection" />' +
		let treecols = threadCols.querySelectorAll("treecol");
		let last = treecols[treecols.length - 1];

		last.parentNode.insertBefore(w.MozXULElement.parseXULToFragment(html), last.nextSibling);
		//console.log("no col");
		//w.gFolderDisplay.hintColumnsChanged();

		//if(cStates.qnoteCol === undefined){
		//w.gFolderDisplay.setColumnStates(cStates);
		//}
		//threadCols.appendChild(w.MozXULElement.parseXULToFragment(html));
	}

	isEditable(row, col) {
		return false;
	}

	cycleCell(row, col) {
	}

	getCellText(row, col) {
		let note = noteGrabber.getNote(this.view.getMsgHdrAt(row).messageId, {row: row});

		if(note.exists && !note.shortText && ColumnHandler.options.textLimit && (typeof note.text === 'string')){
			note.shortText = note.text.substring(0, ColumnHandler.options.textLimit);
		}

		return note.exists ? note.shortText : null;
	}

	getSortStringForRow(hdr) {
		let note = noteGrabber.getNote(hdr.messageId);

		return note.exists ? note.text : null;
	}

	isString() {
		return true;
	}

	getCellProperties(row, col, props){
	}

	getRowProperties(row, props){
	}

	getImageSrc(row, col) {
		let note = noteGrabber.getNote(this.view.getMsgHdrAt(row).messageId, {row: row});

		return note.exists ? extension.rootURI.resolve("images/icon-column.png") : null;
	}

	getSortLongForRow(hdr) {
	}
};

let WindowObserver = {
	observe: function(aSubject, aTopic) {
		//console.log("observe", aTopic);
		if(aTopic === 'domwindowopened'){
			aSubject.addEventListener("DOMContentLoaded", e => {
				let document = e.target;
				let threadCols = document.getElementById("threadCols");

				if(!threadCols) {
					//console.log("not interested in", document.URL);
					return;
				}

				ColumnHandler.attachToWindow(aSubject);
			});
		}
	}
}

let DBViewListener = {
	onCreatedView: widget => {
		let view = widget.view.dbView;
		let qnCH = new QNoteColumnHandler(widget);

		widget.qnCH = qnCH;

		view.addColumnHandler("qnoteCol", qnCH);

		ColumnHandler.handlers.push(qnCH);
	},
	onActiveCreatedView: widget => {
		widget.hintColumnsChanged();
		//console.log("onActiveCreatedView", widget);
	},
	onDestroyingView: (widget, aFolderIsComingBack) => {
		//let view = widget.view.dbView;
		//let qnoteCol = view.getColumnHandler("qnoteCol");
		//console.log("onDestroyingView");
		if(widget.qnCH){
			widget.qnCH.destroy();
		}
	},
	onMessagesLoaded: (widget, aAll) => {
		//console.log("onMessagesLoaded", arguments);
	}
};

ColumnHandler = {
	options: {},
	handlers: [],
	setTextLimit(limit){
		ColumnHandler.options.textLimit = limit;
	},
	attachToWindow(w){
		w.FolderDisplayListenerManager.registerListener(DBViewListener);
		if(w.gFolderDisplay){
			DBViewListener.onCreatedView(w.gFolderDisplay);
		}
	},
	install(options) {
		ColumnHandler.options = options;
		noteGrabber = options.noteGrabber;
		Services.ww.registerNotification(WindowObserver);
		this.attachToWindow(Services.wm.getMostRecentWindow("mail:3pane"));
	},
	uninstall() {
		// console.log("uninstall");
		let qnoteCol;

		for(let i = 0; i < ColumnHandler.handlers.length; i++){
			let w = ColumnHandler.handlers[i].window;
			let view = ColumnHandler.handlers[i].view;

			view.removeColumnHandler("qnoteCol");

			// console.log("uninstall", w, i);
			if(qnoteCol = w.document.getElementById("qnoteCol")){
				qnoteCol.parentNode.removeChild(qnoteCol.previousSibling);
				qnoteCol.parentNode.removeChild(qnoteCol);
			}

			w.FolderDisplayListenerManager.unregisterListener(DBViewListener);
		}

		Services.ww.unregisterNotification(WindowObserver);
	}
};
};
