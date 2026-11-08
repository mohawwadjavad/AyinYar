/* AyinYar file dialogs - Zotero 10.0.6's FilePicker wrapper passes browsingContext correctly. */
(function (root) {
  'use strict';
  const FILE_PICKER_MODULE = 'chrome://zotero/content/modules/filePicker.mjs';

  async function pick(options) {
    const { FilePicker } = ChromeUtils.importESModule(FILE_PICKER_MODULE);
    const picker = new FilePicker();
    const mode = options.mode === 'save' ? picker.modeSave : options.mode === 'folder' ? picker.modeGetFolder : picker.modeOpen;
    // init() in Zotero's wrapper explicitly passes the parent window's BrowsingContext.
    // Do not use Components.classes['@mozilla.org/filepicker;1'].init(window, ...).
    picker.init(root, options.title, mode);
    if (options.filterTitle && options.filterPattern) picker.appendFilter(options.filterTitle, options.filterPattern);
    if (options.defaultString) picker.defaultString = options.defaultString;
    if (options.defaultExtension) picker.defaultExtension = options.defaultExtension;
    const result = await picker.show();
    if (result === picker.returnCancel) return null;
    if (result !== picker.returnOK && result !== picker.returnReplace) {
      throw new Error('نتیجه انتخاب فایل ناشناخته است: ' + result);
    }
    if (!picker.file) throw new Error('مسیر فایل از انتخابگر دریافت نشد.');
    return picker.file;
  }

  function toNativeFile(path) {
    const C = Components.classes, I = Components.interfaces;
    const file = C['@mozilla.org/file/local;1'].createInstance(I.nsIFile);
    file.initWithPath(path);
    return file;
  }

  function writeUTF8(path, data) {
    const C = Components.classes, I = Components.interfaces;
    const output = C['@mozilla.org/network/file-output-stream;1'].createInstance(I.nsIFileOutputStream);
    output.init(toNativeFile(path), 0x02 | 0x08 | 0x20, 0o600, 0);
    const converter = C['@mozilla.org/intl/converter-output-stream;1'].createInstance(I.nsIConverterOutputStream);
    try {
      converter.init(output, 'UTF-8');
      converter.writeString(data);
    }
    finally {
      converter.close();
    }
  }

  function readUTF8(path, maxBytes=1000000) {
    const C=Components.classes, I=Components.interfaces;
    const file=toNativeFile(path);
    if (!file.exists() || !file.isFile()) throw new Error('فایل پشتیبان پیدا نشد.');
    if (file.fileSize>maxBytes) throw new Error('حجم فایل پشتیبان بیش از حد مجاز است.');
    const input=C['@mozilla.org/network/file-input-stream;1'].createInstance(I.nsIFileInputStream);
    input.init(file,0x01,0o400,0);
    const decoder=C['@mozilla.org/intl/converter-input-stream;1'].createInstance(I.nsIConverterInputStream);
    let result='';
    try {
      decoder.init(input,'UTF-8',8192,I.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      const chunk={};
      while(decoder.readString(8192,chunk)!==0){
        result+=chunk.value;
        if (result.length>maxBytes) throw new Error('متن پشتیبان از حد مجاز بزرگ‌تر است.');
      }
    } finally { try{decoder.close();}catch(_){try{input.close();}catch(__){}} }
    return result;
  }
  root.AyinFileDialog = Object.freeze({ pick, toNativeFile, writeUTF8, readUTF8 });
})(window);
