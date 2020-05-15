// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
// Load shell theme from ~/.local/share/themes/name/gnome-shell
/* exported init */

const { Gio, GLib, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;

const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const Night = Me.imports.night.NightThemeSwitch;

const SETTINGS_KEY = 'name';
const STYLESHEET_KEY = 'stylesheet';
const NIGHTTHEME_KEY = 'night';

class ThemeManager {
    constructor() {
        this._settings = ExtensionUtils.getSettings();
    }

    enable() {
        this._enableNight();
        this._changeTheme();
        this._fileMonitor = Gio.file_new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-shell'])).monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._fileChangedId = this._fileMonitor.connect('changed', this._changeTheme.bind(this));
        this._styleChangedId = this._settings.connect(`changed::${STYLESHEET_KEY}`, this._changeTheme.bind(this));
        this._settingChangedId = this._settings.connect(`changed::${SETTINGS_KEY}`, this._changeTheme.bind(this));
    }

    disable() {
        this._disableNight();
        if(this._fileChangedId) this._fileMonitor.disconnect(this._fileChangedId), this._fileChangedId = 0;
        if(this._styleChangedId) this._settings.disconnect(this._styleChangedId), this._styleChangedId = 0;
        if(this._settingChangedId) this._settings.disconnect(this._settingChangedId), this._settingChangedId = 0;

        this._fileMonitor = null;
        Main.setThemeStylesheet(null);
        Main.loadTheme();
    }

    _enableNight() {
        this._night = new Night();
        this._night._active = this._settings.get_boolean(NIGHTTHEME_KEY);
        if(this._night._active) this._night.enable();
        this._nightId = this._settings.connect(`changed::${NIGHTTHEME_KEY}`, () => {
            this._night._active ? this._night.disable() : this._night.enable();
            this._night._active = !this._night._active;
        })
    }

    _disableNight() {
        if(this._night._active) this._night.disable();
        this._night = null;
    }

    _changeTheme() {
        let stylesheet = null;
        let themeName = this._settings.get_string(SETTINGS_KEY);

        if (themeName) {
            const stylesheetPaths = Util.getThemeDirs()
                .map(dir => `${dir}/${themeName}/gnome-shell/gnome-shell.css`);

            stylesheetPaths.push(...Util.getModeThemeDirs()
                .map(dir => `${dir}/${themeName}.css`));

            stylesheet = stylesheetPaths.find(path => {
                let file = Gio.file_new_for_path(path);
                return file.query_exists(null);
            });
        }

        if (stylesheet)
            global.log(`loading user theme: ${stylesheet}`);
        else
            global.log('loading default theme (Adwaita)');
        Main.setThemeStylesheet(stylesheet);

        this._settings.get_boolean(STYLESHEET_KEY) ? this._loadTheme() : Main.loadTheme();
    }

    _loadTheme() {
        let userStylesheet;
        if(this._night._active && this._night._proxy.NightLightActive) {
            userStylesheet = Gio.file_new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-shell', 'gnome-shell-dark.css']));
            if(!userStylesheet.query_exists(null))
                userStylesheet = Gio.file_new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-shell', 'gnome-shell.css']));
        } else {
            userStylesheet = Gio.file_new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-shell', 'gnome-shell.css']));
        }

        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        let privousTheme = themeContext.get_theme();

        let theme = new St.Theme({
            application_stylesheet : userStylesheet.query_exists(null) ? userStylesheet : null,
            theme_stylesheet :  Main.getThemeStylesheet(),
            default_stylesheet : Main._getDefaultStylesheet(),
        });

        if (theme.default_stylesheet === null)
            throw new Error("No valid stylesheet found for '%s'".format(Main.sessionMode.stylesheetName));

        if (privousTheme) {
            let customStylesheets = privousTheme.get_custom_stylesheets();
            for (let i = 0; i < customStylesheets.length; i++)
                theme.load_stylesheet(customStylesheets[i]);
        }

        themeContext.set_theme(theme);
    }
}

function init() {
    return new ThemeManager();
}
