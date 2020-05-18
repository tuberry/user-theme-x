// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
// Load shell theme from ~/.local/share/themes/name/gnome-shell
/* exported init */

const { Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;

const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;

const SETTINGS_KEY = 'name';
const NIGHTTHEME_KEY = 'night';
const STYLESHEET_KEY = 'stylesheet';

const Style = new Me.imports.style.UserStylesheet();
const Night = new Me.imports.night.NightThemeSwitch();

class ThemeManager {
    constructor() {
        this._settings = ExtensionUtils.getSettings();
    }

    enable() {
        this._enable();
        this._changeTheme();
        this._settingChangedId = this._settings.connect(`changed::${SETTINGS_KEY}`, this._changeTheme.bind(this));
    }

    disable() {
        this._disable();
        if(this._settingChangedId) this._settings.disconnect(this._settingChangedId), this._settingChangedId = 0;

        Main.setThemeStylesheet(null);
        Main.loadTheme();
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
        Main.loadTheme();
    }

    _enable() {
        if(this._settings.get_boolean(STYLESHEET_KEY)) Style.enable();
        this._fileChangedId = Style.connect('file-changed', this._changeTheme.bind(this));
        this._styleChangedId = this._settings.connect(`changed::${STYLESHEET_KEY}`, () => {
            this._settings.get_boolean(STYLESHEET_KEY) ? Style.enable() : Style.disable();
            this._changeTheme();
        });

        if(this._settings.get_boolean(NIGHTTHEME_KEY)) Night.enable();
        this._nightChangedId = this._settings.connect(`changed::${NIGHTTHEME_KEY}`, () => {
            this._settings.get_boolean(NIGHTTHEME_KEY) ? Night.enable() : Night.disable();
        });
    }

    _disable() {
        if(this._settings.get_boolean(NIGHTTHEME_KEY)) Night.disable();
        if(this._settings.get_boolean(STYLESHEET_KEY)) Style.disable();
        if(this._fileChangedId) Style.disconnect(this._fileChangedId), this._fileChangedId = 0;
        if(this._styleChangedId) this._settings.disconnect(this._styleChangedId), this._styleChangedId = 0;
        if(this._nightChangedId) this._settings.disconnect(this._nightChangedId), this._nightChangedId = 0;
    }
}

function init() {
    return new ThemeManager();
}
