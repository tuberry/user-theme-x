// vim:fdm=syntax
// by: tuberry
/* exported init */

const { Gio, GLib, St } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const { Fields, System } = Me.imports.fields;
const LightProxy = Main.panel.statusArea.quickSettings._nightLight._proxy;

const noop = () => {};
const newFile = (...x) => Gio.File.new_for_path(GLib.build_filenamev(x));
const newConf = (...x) => newFile(GLib.get_user_config_dir(), ...x);
const sync = (s1, k1, s2, k2) => s1.get_string(k1) !== s2.get_string(k2) && s1.set_string(k1, s2.get_string(k2));
const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const DARK = 'gnome-shell-dark.css';
const LIGHT = 'gnome-shell.css';
const genXML = (light, dark) => `<?xml version="1.0"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
    <wallpaper deleted="false">
        <name>user-theme-x</name>
        <filename>${light}</filename>
        <filename-dark>${dark}</filename-dark>
        <options>zoom</options>
        <pcolor>#ffffff</pcolor>
        <scolor>#000000</scolor>
    </wallpaper>
</wallpapers>`;

Gio._promisify(Gio.File.prototype, 'create_async');
Gio._promisify(Gio.File.prototype, 'make_directory_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_async');

class Field {
    constructor(prop, gset, obj) {
        this.gset = typeof gset === 'string' ? new Gio.Settings({ schema: gset }) : gset;
        this.prop = prop;
        this.bind(obj);
    }

    _get(x) {
        return this.gset[`get_${this.prop[x][1]}`](this.prop[x][0]);
    }

    _set(x, y) {
        this.gset[`set_${this.prop[x][1]}`](this.prop[x][0], y);
    }

    bind(a) {
        let fs = Object.entries(this.prop);
        fs.forEach(([x]) => { a[x] = this._get(x); });
        this.gset.connectObject(...fs.flatMap(([x, [y]]) => [`changed::${y}`, () => { a[x] = this._get(x); }]), a);
    }

    unbind(a) {
        this.gset.disconnectObject(a);
    }
}

class ThemeTweaks {
    constructor() {
        this._buildWidgets();
        this._bindSettings();
    }

    _buildWidgets() {
        this.sgset = ExtensionUtils.getSettings();
        this.tgset = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
    }

    _bindSettings() {
        this._dfield = new Field({
            light: [System.LPIC, 'string'],
            dark:  [System.DPIC, 'string'],
        }, 'org.gnome.desktop.background', this);
        this._sfield = new Field({
            night: [Fields.NIGHT, 'boolean'],
            style: [Fields.STYLE, 'boolean'],
            shell: [System.SHELL, 'string'],
            paper: [Fields.PAPER, 'boolean'],
        }, this.sgset, this);
        this._nfield = new Field({
            light_on: [System.NIGHTLIGHT, 'boolean'],
        }, 'org.gnome.settings-daemon.plugins.color', this);
        LightProxy.connectObject('g-properties-changed', this._onLightChanged.bind(this), this);
    }

    get _isNight() {
        return LightProxy?.NightLightActive && this._night && this._light_on;
    }

    async _onLightChanged() {
        if(this._style) await this._loadStyle();
        if(this._night) this._syncTheme();
    }

    _syncTheme() {
        Main.layoutManager.screenTransition.run();
        if(this._isNight) {
            Items.forEach(x => sync(this.tgset, System[x], this.sgset, `${Fields[x]}-night`));
            sync(this.sgset, System.SHELL, this.sgset, `${Fields.SHELL}-night`);
        } else {
            Items.forEach(x => sync(this.tgset, System[x], this.sgset, Fields[x]));
            sync(this.sgset, System.SHELL, this.sgset, Fields.SHELL);
        }
    }

    async _loadStyle() {
        let context = St.ThemeContext.get_for_stage(global.stage);
        let next = new St.Theme({
            application_stylesheet: Main.getThemeStylesheet(),
            default_stylesheet: Main._getDefaultStylesheet(),
        });
        let day = newConf('gnome-shell', LIGHT);
        let night = newConf('gnome-shell', DARK);
        if(this._isNight && await Util.checkFile(night).catch(noop)) next.load_stylesheet(night);
        else if(await Util.checkFile(day).catch(noop)) next.load_stylesheet(day);
        else throw new Error('stylesheet not found');
        if(!next.default_stylesheet) throw new Error(`No valid stylesheet found for “${Main.sessionMode.stylesheetName}”`);
        context.get_theme()?.get_custom_stylesheets().forEach(x => (!x.equal(day) && !x.equal(night)) && next.load_stylesheet(x));
        context.set_theme(next);
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        [LIGHT, DARK].forEach(x => theme?.unload_stylesheet(newConf('gnome-shell', x)));
    }

    set light_on(on) {
        if(this._light_on === on) return;
        this._light_on = on;
        this._onLightChanged().catch(noop);
    }

    set night(night) { // sync values: 5 sys <=> 10 user
        if(this._night === night) return;
        if((this._night = night)) {
            this._syncTheme();
            let f1 = (s1, k1, s2, k2) => [`changed::${k1}`, () => sync(s2, this._isNight ? `${k2}-night` : k2, s1, k1)];
            let f2 = (s1, k1, s2, k2) => [`changed::${k1}`, () => this._isNight || sync(s2, k2, s1, k1)];
            let f3 = (s1, k1, s2, k2) => [`changed::${k1}`, () => this._isNight && sync(s2, k2, s1, k1)];
            this.tgset.connectObject(...Items.flatMap(x => f1(this.tgset, System[x], this.sgset, Fields[x])), this);
            this.sgset.connectObject(...Items.flatMap(x => f2(this.sgset, Fields[x], this.tgset, System[x]))
                                     .concat(Items.flatMap(x => f3(this.sgset, `${Fields[x]}-night`, this.tgset, System[x])))
                                     .concat(f1(this.sgset, System.SHELL, this.sgset, Fields.SHELL))
                                     .concat(f2(this.sgset, Fields.SHELL, this.sgset, System.SHELL))
                                     .concat(f3(this.sgset, `${Fields.SHELL}-night`, this.sgset, System.SHELL)), this);
        } else {
            ['tgset', 'sgset'].forEach(x => this[x].disconnectObject(this));
        }
    }

    set light(light) {
        this._light = light;
        if(this._paper === undefined) return;
        this.paper = this._paper;
    }

    set dark(dark) {
        this._dark = dark;
        this.paper = this._paper;
    }

    set paper(paper) {
        this._paper = paper;
        if(!this._paper || !this._dark || !this._light) return;
        this._writeToXML().catch(noop);
    }

    async _writeToXML() {
        let dir = newFile(GLib.get_user_data_dir(), 'gnome-background-properties');
        await dir.make_directory_async(GLib.PRIORITY_DEFAULT, null).catch(noop);
        let file = newFile(GLib.get_user_data_dir(), 'gnome-background-properties', 'user-theme-x-wallpaper.xml');
        await file.create_async(Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, null).catch(noop);
        await file.replace_contents_async(new TextEncoder().encode(genXML(this._light, this._dark)),
            null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }

    set style(style) {
        if((this._style = style)) {
            if(this._fileMonitor) return;
            this._emitCount = 0;
            this._fileMonitor = newConf('gnome-shell').monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._fileMonitor.connect('changed', () => {
                if(++this._emitCount !== 10) return; // NOTE: ugly hack for 10 signals when saving file
                this._emitCount = 0;
                this._loadStyle().catch(noop);
            });
            this._loadStyle().catch(noop);
        } else {
            if(!this._fileMonitor) return;
            this._fileMonitor.cancel();
            this._fileMonitor = null;
            this._unloadStyle();
        }
    }

    set shell(shell) {
        if(shell) {
            let paths = Util.getThemeDirs().map(x => `${x}/${shell}/gnome-shell/gnome-shell.css`)
                .concat(Util.getModeThemeDirs().map(x => `${x}/${shell}.css`));
            Promise.any(paths.map(async x => await Util.checkFile(Gio.File.new_for_path(x)) && x))
                .then(this._loadShellTheme.bind(this)).catch(() => this._loadShellTheme(null));
        } else {
            this._loadShellTheme(null);
        }
    }

    _loadShellTheme(stylesheet) {
        try {
            Main.setThemeStylesheet(stylesheet);
            Main.loadTheme();
        } catch(e) {
            // ignore
        }
    }

    destroy() {
        LightProxy.disconnectObject(this);
        ['_nfield', '_sfield', '_dfield'].forEach(x => this[x].unbind(this));
        this.style = this.night = this.shell = null;
    }
}

class Extension {
    enable() {
        this._ext = new ThemeTweaks();
    }

    disable() {
        this._ext.destroy();
        this._ext = null;
    }
}

function init() {
    return new Extension();
}
