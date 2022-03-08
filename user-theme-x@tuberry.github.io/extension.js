// vim:fdm=syntax
// by: tuberry
/* exported init */

const { Gio, GLib, GObject, St } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const Fields = Me.imports.fields.Fields;
const System = Me.imports.fields.System;
const LightProxy = Main.panel.statusArea.aggregateMenu._nightLight._proxy;

const noop = () => {};
const newFile = (...x) => Gio.File.new_for_path(GLib.build_filenamev(x));
const newConf = (...x) => newFile(GLib.get_user_config_dir(), ...x);
const sync = (s1, k1, s2, k2) => s1.get_string(k1) !== s2.get_string(k2) && s1.set_string(k1, s2.get_string(k2));
const genParam = (type, name, ...dflt) => GObject.ParamSpec[type](name, name, name, GObject.ParamFlags.READWRITE, ...dflt);
const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const DARK = 'gnome-shell-dark.css';
const LIGHT = 'gnome-shell.css';
const BG_XML =
`<?xml version="1.0"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
    <wallpaper deleted="false">
        <name>user-theme-x</name>
        <filename>%s</filename>
        <filename-dark>%s</filename-dark>
        <options>zoom</options>
        <pcolor>#ffffff</pcolor>
        <scolor>#000000</scolor>
    </wallpaper>
</wallpapers>`;

let [sgsettings, ngsettings, tgsettings, dgsettings] = Array(4).fill(null);

Gio._promisify(Gio.File.prototype, 'create_async');
Gio._promisify(Gio.File.prototype, 'make_directory_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_async');

class ThemeTweaks extends GObject.Object {
    static {
        GObject.registerClass({
            Properties: {
                dark:  genParam('string', 'dark', ''),
                light: genParam('string', 'light', ''),
                shell: genParam('string', 'shell', ''),
                night: genParam('boolean', 'night', false),
                paper: genParam('boolean', 'paper', false),
                style: genParam('boolean', 'style', false),
            },
        }, this);
    }

    constructor() {
        super();
        [[Fields.NIGHT, 'night'], [Fields.STYLE, 'style'], [System.SHELL, 'shell'], [Fields.PAPER, 'paper']]
            .forEach(([x, y, z]) => sgsettings.bind(x, this, y, z ?? Gio.SettingsBindFlags.GET));
        [[System.LPIC, 'light'], [System.DPIC, 'dark']].forEach(([x, y, z]) => dgsettings.bind(x, this, y, z ?? Gio.SettingsBindFlags.GET));
        LightProxy.connectObject('g-properties-changed', this._onLightChanged.bind(this), this);
        ngsettings.connectObject('changed::%s'.format(System.NIGHTLIGHT), this._onLightChanged.bind(this), this);
    }

    get _isNight() {
        return LightProxy?.NightLightActive && sgsettings.get_boolean(Fields.NIGHT) && ngsettings.get_boolean(System.NIGHTLIGHT);
    }

    async _onLightChanged() {
        if(this._style) await this._loadStyle();
        if(this._night) this._syncTheme();
    }

    _syncTheme() {
        if(this._isNight) {
            Items.forEach(x => sync(tgsettings, System[x], sgsettings, '%s-night'.format(Fields[x])));
            sync(sgsettings, System.SHELL, sgsettings, '%s-night'.format(Fields.SHELL));
        } else {
            Items.forEach(x => sync(tgsettings, System[x], sgsettings, Fields[x]));
            sync(sgsettings, System.SHELL, sgsettings, Fields.SHELL);
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
        if(!next.default_stylesheet) throw new Error("No valid stylesheet found for '%s'".format(Main.sessionMode.stylesheetName));
        context.get_theme()?.get_custom_stylesheets().forEach(x => { if(!x.equal(day) && !x.equal(night)) next.load_stylesheet(x); });
        context.set_theme(next);
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        [LIGHT, DARK].forEach(x => theme?.unload_stylesheet(newConf('gnome-shell', x)));
    }

    set night(night) { // sync values: 5 sys <=> 10 user
        if(this._night === night) return;
        if((this._night = night)) {
            this._syncTheme();
            let f1 = (s1, k1, s2, k2) => ['changed::%s'.format(k1), () => { sync(s2, this._isNight ? '%s-night'.format(k2) : k2, s1, k1); }];
            let f2 = (s1, k1, s2, k2) => ['changed::%s'.format(k1), () => { if(!this._isNight) sync(s2, k2, s1, k1); }];
            let f3 = (s1, k1, s2, k2) => ['changed::%s'.format(k1), () => { if(this._isNight) sync(s2, k2, s1, k1); }];
            tgsettings.connectObject(...Items.flatMap(x => f1(tgsettings, System[x], sgsettings, Fields[x])), this);
            sgsettings.connectObject(...Items.flatMap(x => f2(sgsettings, Fields[x], tgsettings, System[x]))
                                     .concat(Items.flatMap(x => f3(sgsettings, '%s-night'.format(Fields[x]), tgsettings, System[x])))
                                     .concat(f1(sgsettings, System.SHELL, sgsettings, Fields.SHELL))
                                     .concat(f2(sgsettings, Fields.SHELL, sgsettings, System.SHELL))
                                     .concat(f3(sgsettings, '%s-night'.format(Fields.SHELL), sgsettings, System.SHELL)), this);
        } else {
            [tgsettings, sgsettings].forEach(x => x.disconnectObject(this));
        }
    }

    set light(light) {
        this._light = light;
        this.paper = true;
    }

    set dark(dark) {
        this._dark = dark;
        this.paper = true;
    }

    set paper(paper) {
        if(paper) {
            if(!this._dark || !this._light) return;
            this._writeToXML().catch(noop);
        } else {
            //
        }
    }

    async _writeToXML() {
        let dir = newFile(GLib.get_user_data_dir(), 'gnome-background-properties');
        await dir.make_directory_async(GLib.PRIORITY_DEFAULT, null).catch(noop);
        let file = newFile(GLib.get_user_data_dir(), 'gnome-background-properties', 'user-theme-x-wallpaper.xml');
        await file.create_async(Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, null).catch(noop);
        await file.replace_contents_async(new TextEncoder().encode(BG_XML.format(this._light, this._dark)),
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
            let paths = Util.getThemeDirs().map(x => '%s/%s/gnome-shell/gnome-shell.css'.format(x, shell))
                .concat(Util.getModeThemeDirs().map(x => '%s/%s.css'.format(x, shell)));
            Promise.any(paths.map(async x => await Util.checkFile(Gio.File.new_for_path(x)) && x))
                .then(this._loadShellTheme.bind(this)).catch(() => { this._loadShellTheme(null); });
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
        ngsettings.disconnectObject(this);
        LightProxy.disconnectObject(this);
        this.style = this.night = this.shell = null;
    }
}

class Extension {
    enable() {
        sgsettings = ExtensionUtils.getSettings();
        tgsettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        dgsettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
        ngsettings = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.color' });
        this._ext = new ThemeTweaks();
    }

    disable() {
        this._ext.destroy();
        sgsettings = tgsettings = ngsettings = dgsettings = this._ext = null;
    }
}

function init() {
    return new Extension();
}
