// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
// Load shell theme from ~/.local/share/themes/name/gnome-shell
/* exported init */

const { Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;

const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;

const SETTINGS_KEY = 'name';

class ThemeManager {
    constructor() {
        this._settings = ExtensionUtils.getSettings();
    }

    enable() {
        this._tweaks = new Me.imports.tweaks.ThemeTweaks();
        this._changeTheme();
        this._settingChangedId = this._settings.connect(`changed::${SETTINGS_KEY}`, this._changeTheme.bind(this));
    }

    disable() {
        this._tweaks.destroy();
        delete this._tweaks;
        if(this._settingChangedId) this._settings.disconnect(this._settingChangedId), this._settingChangedId = 0;

        try {
            Main.setThemeStylesheet(null);
            Main.loadTheme();
        } catch(e) {
            // ignore upstream issue sometimes after screen locking
            // Argument 'file' (type interface) may not be null loadTheme@resource:///org/gnome/shell/ui/main.js:428:19
        }
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
                let file = Gio.File.new_for_path(path);
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
}

function init() {
    return new ThemeManager();
}
