class XULNoteWindow extends NoteWindow {
	constructor(windowId) {
		super(windowId);

		// TODO: need to add some filters to the events

		// Close
		browser.qpopup.onRemoved.addListener(popupId => {
			if(popupId === this.popupId){
				super.close();
			}
		});

		// Move around
		browser.qpopup.onMove.addListener(popup => {
			if(popup.id === this.popupId){
				let { top, left } = popup;
				this.note.left = left;
				this.note.top = top;
			}
		});

		// Resize
		browser.qpopup.onResize.addListener(popup => {
			if(popup.id === this.popupId){
				let { width, height } = popup;
				this.note.width = width;
				this.note.height = height;
			}
		});
	}

	async update(opt){
		return browser.qpopup.update(this.popupId, opt);
	}

	// let escaper = e => {
	// 	if(e.key === 'Escape'){
	// 		if(wex.CurrentNote.windowId){
	// 			wex.CurrentNote.needSaveOnClose = false;
	// 			wex.CurrentNote.close();
	// 			e.preventDefault();
	// 		}
	// 	}
	// };

	// window.addEventListener("keydown", escaper);

	// n.onClose = () => {
	// 	window.removeEventListener("keydown", escaper);
	// };
	// async popupIsFocused(id){
	// 	if(this.popups.has(id)){
	// 		return this.popups.get(id).isFocused();
	// 	}
	// },
	// async popupFocus(id){
	// 	if(this.popups.has(id)){
	// 		return this.popups.get(id).focus();
	// 	}
	// },

	async isFocused() {
		return browser.qpopup.get(this.popupId).then(popupInfo => {
			return popupInfo ? popupInfo.focused : false;
		});
	}

	async focus() {
		return this.update({
			focused: true
		});
	}

	async close() {
		super.close(async () => {
			if(this.popupId){
				return browser.qpopup.remove(this.popupId);
			}
			// if(this.popupId){
			// 	return browser.qpopup.remove(this.popupId).then(() => {
			// 		return true;
			// 	},() => {
			// 		return false;
			// 	});
			// } else {
			// 	return false;
			// }
		});
	}

	async pop() {
		return super.pop(async () => {
			let note = this.note;
			let opt = {
				windowId: this.windowId,
				url: "html/popup4.html",
				title: "QNote",
				width: note.width || Prefs.width,
				height: note.height || Prefs.height,
				left: note.left || 0,
				top: note.top || 0
			};

			// MAYBE: preconfigured positions?
			let centeredBox = this._center(opt, await this._getWindowRect());

			if(!opt.left){
				opt.left = centeredBox.left;
			}

			if(!opt.top){
				opt.top = centeredBox.top;
			}

			return browser.qpopup.create(opt).then(popupInfo => {
				this.popupId = popupInfo.id;
				return true;
			});
		});
	}
}
