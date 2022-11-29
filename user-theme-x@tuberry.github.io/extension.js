// vim:fdm=syntax
// by: tuberry
/* exported init */

const { Gio, GLib, St } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const { Fields, Field, System } = Me.imports.fields;
const LightProxy = Main.panel.statusArea.quickSettings._nightLight._proxy;

const noop = () => {};
const fl = (...x) => Gio.File.new_for_path(GLib.build_filenamev(x));
const conf = (...x) => fl(GLib.get_user_config_dir(), ...x);
const sync = (s1, k1, s2, k2) => s1.get_string(k1) !== s2.get_string(k2) && s2.set_string(k2, s1.get_string(k1));
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

Gio._promisify(Gio.File.prototype, 'make_directory_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_async');

class ThemeTweaks {
    constructor() {
        this._buildWidgets();
        this._bindSettings();
        this._syncNightLight();
    }

    _buildWidgets() {
        this.sgset = ExtensionUtils.getSettings();
        this.tgset = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
    }

    _bindSettings() {
        this._sfield = new Field({
            night: [Fields.NIGHT, 'boolean'],
            style: [Fields.STYLE, 'boolean'],
            shell: [System.SHELL, 'string'],
        }, this.sgset, this).attach({
            paper: [Fields.PAPER, 'boolean'],
        }, this, 'wallpaper');
        this._dfield = new Field({
            lpic: [System.LPIC, 'string'],
            dpic: [System.DPIC, 'string'],
        }, 'org.gnome.desktop.background', this, 'wallpaper');
        LightProxy.connectObject('g-properties-changed',
            (_l, p) => p.lookup_value('NightLightActive', null) && this._syncNightLight(), this);
    }

    _syncNightLight() {
        if(LightProxy.NightLightActive === null) return;
        this.night_light = LightProxy.NightLightActive;
        if(this._style) this._loadStyle().catch(noop);
        if(this._night) this._syncTheme();
    }

    isNight() {
        return this.night_light && this._night;
    }

    set night(night) { // sync values: 5 sys <=> 10 user
        if(this._night === night) return;
        if((this._night = night)) {
            this._syncTheme();
            let f1 = (a, b, c, d) => [`changed::${b}`, () => sync(a, b, c, this.isNight() ? `${d}-night` : d)],
                f2 = (a, b, c, d) => [`changed::${b}`, () => this.isNight() || sync(a, b, c, d)],
                f3 = (a, b, c, d) => [`changed::${b}`, () => this.isNight() && sync(a, b, c, d)];
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

    _syncTheme() {
        if(!('night_light' in this)) return;
        // Main.layoutManager.screenTransition.run();
        if(this.isNight()) {
            Items.forEach(x => sync(this.sgset, `${Fields[x]}-night`, this.tgset, System[x]));
            sync(this.sgset, `${Fields.SHELL}-night`, this.sgset, System.SHELL);
        } else {
            Items.forEach(x => sync(this.sgset, Fields[x], this.tgset, System[x]));
            sync(this.sgset, Fields.SHELL, this.sgset, System.SHELL);
        }
    }

    set wallpaper([k, v]) {
        this[k] = v;
        this._writeToXML().catch(noop);
    }

    async _writeToXML() {
        if(!(this.paper && this.dpic && this.lpic)) return;
        let dir = fl(GLib.get_user_data_dir(), 'gnome-background-properties');
        await dir.make_directory_async(GLib.PRIORITY_DEFAULT, null).catch(noop);
        let file = fl(GLib.get_user_data_dir(), 'gnome-background-properties', 'user-theme-x-wallpaper.xml');
        await file.touch_async().catch(noop);
        await file.replace_contents_async(new TextEncoder().encode(genXML(this.lpic, this.dpic)),
            null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }

    set style(style) {
        if((this._style = style)) {
            if(this._fileMonitor) return;
            this._fileMonitor = conf('gnome-shell').monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._fileMonitor.connect('changed', (_o, _s, _t, e) => e !== Gio.FileMonitorEvent.CHANGED && this._loadStyle().catch(noop));
            this._loadStyle().catch(noop);
        } else {
            if(!this._fileMonitor) return;
            this._fileMonitor.cancel();
            this._fileMonitor = null;
            this._unloadStyle();
        }
    }

    async _loadStyle() {
        let context = St.ThemeContext.get_for_stage(global.stage);
        let next = new St.Theme({
            application_stylesheet: Main.getThemeStylesheet(),
            default_stylesheet: Main._getDefaultStylesheet(),
        });
        let day = conf('gnome-shell', LIGHT);
        let night = conf('gnome-shell', DARK);
        if(this.isNight() && await Util.checkFile(night).catch(noop)) next.load_stylesheet(night);
        else if(await Util.checkFile(day).catch(noop)) next.load_stylesheet(day);
        else throw new Error('stylesheet not found');
        if(!next.default_stylesheet) throw new Error(`No valid stylesheet found for “${Main.sessionMode.stylesheetName}”`);
        context.get_theme()?.get_custom_stylesheets().forEach(x => (!x.equal(day) && !x.equal(night)) && next.load_stylesheet(x));
        context.set_theme(next);
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        [LIGHT, DARK].forEach(x => theme?.unload_stylesheet(conf('gnome-shell', x)));
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
        ['_sfield', '_dfield'].forEach(x => this[x].detach(this));
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
