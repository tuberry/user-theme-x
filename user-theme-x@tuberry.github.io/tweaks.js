// vim:fdm=syntax
// by: tuberry@github
'use strict';

const Main = imports.ui.main;
const { Gio, GLib, GObject, St } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const System = {
    SHELL:       'name',
    THEME:       'gtk-theme',
    ICONS:       'icon-theme',
    CURSOR:      'cursor-theme',
    NIGHTLIGHT:  'night-light-enabled',
    THEMESCHEMA: 'org.gnome.desktop.interface',
    NIGHTSCHEMA: 'org.gnome.settings-daemon.plugins.color',
};

const sgsettings = imports.misc.extensionUtils.getSettings();
const tgsettings = new Gio.Settings({ schema: System.THEMESCHEMA });
const ngsettings = new Gio.Settings({ schema: System.NIGHTSCHEMA });

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Fields = Me.imports.fields.Fields;

const newFile = x => Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir()].concat(x)));
const sync = (scm_a, key_a, scm_b, key_b) => {
    if(scm_a.get_string(key_a) != scm_b.get_string(key_b))
        scm_a.set_string(key_a, scm_b.get_string(key_b));
}

var ThemeTweaks = GObject.registerClass({
    Properties: {
        'night': GObject.ParamSpec.boolean('night', 'night', 'night', GObject.ParamFlags.WRITABLE, false),
        'style': GObject.ParamSpec.boolean('style', 'style', 'style', GObject.ParamFlags.WRITABLE, false),
    },
}, class ThemeTweaks extends GObject.Object {
    _init() {
        super._init();
        sgsettings.bind(Fields.NIGHT, this, 'night', Gio.SettingsBindFlags.GET);
        sgsettings.bind(Fields.STYLE, this, 'style', Gio.SettingsBindFlags.GET);
        this._proxyChangedId = LightProxy.connect('g-properties-changed', this._onLightChanged.bind(this));
        this._nightLightOnId = ngsettings.connect('changed::' + System.NIGHTLIGHT, this._onLightChanged.bind(this));
    }

    get _isNight() {
        return LightProxy.NightLightActive
            && sgsettings.get_boolean(Fields.NIGHT)
            && ngsettings.get_boolean(System.NIGHTLIGHT);
    }

    _onLightChanged() {
        if(this._style) this._loadStyle();
        if(this._night) this._syncTheme();
    }

    _syncTheme() {
        if(this._isNight) {
            sync(tgsettings, System.THEME,  sgsettings, Fields.GTKNIGHT);
            sync(sgsettings, System.SHELL,  sgsettings, Fields.SHELLNIGHT);
            sync(tgsettings, System.ICONS,  sgsettings, Fields.ICONSNIGHT);
            sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSORNIGHT);
        } else {
            sync(tgsettings, System.THEME,  sgsettings, Fields.GTK);
            sync(sgsettings, System.SHELL,  sgsettings, Fields.SHELL);
            sync(tgsettings, System.ICONS,  sgsettings, Fields.ICONS);
            sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSOR);
        }
    }

    _loadStyle() {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        let newTheme = new St.Theme({
            application_stylesheet: Main.getThemeStylesheet(),
            default_stylesheet: Main._getDefaultStylesheet(),
        });

        let day = newFile(['gnome-shell', 'gnome-shell.css']);
        let night = newFile(['gnome-shell', 'gnome-shell-dark.css']);

        if(night.query_exists(null) && this._isNight) {
            newTheme.load_stylesheet(night);
        } else if(day.query_exists(null)) {
            newTheme.load_stylesheet(day);
        } else {
            log('Could not find user stylesheet "~/.config/gnome-shell/gnome-shell{,-dark}.css"');
            return;
        }

        if(newTheme.default_stylesheet === null)
            throw new Error("No valid stylesheet found for '%s'".format(Main.sessionMode.stylesheetName));

        let previousTheme = themeContext.get_theme();
        if(previousTheme)
            previousTheme.get_custom_stylesheets().forEach(x => { if(!x.equal(day) && !x.equal(night)) newTheme.load_stylesheet(x); });

        themeContext.set_theme(newTheme);
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        if(!theme) return;
        let day = newFile(['gnome-shell', 'gnome-shell.css']);
        let night = newFile(['gnome-shell', 'gnome-shell-dark.css']);
        if(day.query_exists(null)) theme.unload_stylesheet(day);
        if(night.query_exists(null)) theme.unload_stylesheet(night);
    }

    set night(night) {
        this._night = night;
        if(night) { // sync values: 4 sys <=> 8 user
            this._syncTheme();
            this._themeChangedId  = tgsettings.connect('changed::' + System.THEME, () => {
                sync(sgsettings, this._isNight ? Fields.GTKNIGHT : Fields.GTK, tgsettings, System.THEME);
            });
            this._iconsChangedId  = tgsettings.connect('changed::' + System.ICONS, () => {
                sync(sgsettings, this._isNight ? Fields.ICONSNIGHT : Fields.ICONS, tgsettings, System.ICONS);
            });
            this._cursorChangedId = tgsettings.connect('changed::' + System.CURSOR, () => {
                sync(sgsettings, this._isNight ? Fields.CURSORNIGHT : Fields.CURSOR, tgsettings, System.CURSOR);
            });
            this._shellChangedID  = sgsettings.connect('changed::' + System.SHELL, () => {
                sync(sgsettings, this._isNight ? Fields.SHELLNIGHT : Fields.SHELL, sgsettings, System.SHELL);
            });

            this._gtkID = sgsettings.connect('changed::' + Fields.GTK, () => {
                if(!this._isNight) sync(tgsettings, System.THEME, sgsettings, Fields.GTK);
            });
            this._shellID = sgsettings.connect('changed::' + Fields.SHELL, () => {
                if(!this._isNight) sync(sgsettings, System.SHELL, sgsettings, Fields.SHELL);
            });
            this._iconsID = sgsettings.connect('changed::' + Fields.ICONS, () => {
                if(!this._isNight) sync(tgsettings, System.ICONS, sgsettings, Fields.ICONS);
            });
            this._cursorID = sgsettings.connect('changed::' + Fields.CURSOR, () => {
                if(!this._isNight) sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSOR);
            });
            this._gtkNID = sgsettings.connect('changed::' + Fields.GTKNIGHT, () => {
                if(this._isNight) sync(tgsettings, System.THEME, sgsettings, Fields.GTKNIGHT);
            });
            this._shellNID = sgsettings.connect('changed::' + Fields.SHELLNIGHT, () => {
                if(this._isNight) sync(sgsettings, System.SHELL, sgsettings, Fields.SHELLNIGHT);
            });
            this._iconsNID = sgsettings.connect('changed::' + Fields.ICONSNIGHT, () => {
                if(this._isNight) sync(tgsettings, System.ICONS, sgsettings, Fields.ICONSNIGHT);
            });
            this._cursorNID = sgsettings.connect('changed::' + Fields.CURSORNIGHT, () => {
                if(this._isNight) sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSORNIGHT);
            });
        } else {
            if(this._themeChangedId)
                tgsettings.disconnect(this._themeChangedId), this._themeChangedId = 0;
            if(this._iconsChangedId)
                tgsettings.disconnect(this._iconsChangedId), this._iconsChangedId = 0;
            if(this._cursorChangedId)
                tgsettings.disconnect(this._cursorChangedId), this._cursorChangedId = 0;
            for(let x in this)
                if(RegExp(/^_.+ID$/).test(x)) eval('if(this.%s) sgsettings.disconnect(this.%s), this.%s = 0;'.format(x, x, x));
        }
    }

    set style(style) {
        this._style = style;
        if(style) {
            this._loadStyle();
            this._emitCount = 0;
            this._fileMonitor = newFile(['gnome-shell']).monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._fileChangedId = this._fileMonitor.connect('changed', (file, other, type) => {
                if(++this._emitCount != 10) return; // NOTE: ugly hack for 10 signals when saving file
                this._emitCount = 0;
                this._loadStyle();
            });
        } else {
            this._unloadStyle();
            if(this._fileChangedId)
                this._fileMonitor.disconnect(this._fileChangedId), this._fileChangedId = 0;
            delete this._fileMonitor;
        }
    }

    destroy() {
        this.style = false;
        this.night = false;
        if(this._nightLightOnId)
            ngsettings.disconnect(this._nightLightOnId), this._nightLightOnId = 0;
        if(this._proxyChangedId)
            LightProxy.disconnect(this._proxyChangedId), this._proxyChangedId = 0;
    }
});

