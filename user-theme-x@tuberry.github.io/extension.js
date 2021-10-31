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
        this._settingChangedId = this._settings.connect('changed::%s'.format(SETTINGS_KEY), this._changeTheme.bind(this));
    }

    disable() {
        this._tweaks.destroy();
        delete this._tweaks;
        if(this._settingChangedId) this._settings.disconnect(this._settingChangedId), delete this._settingChangedId;

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

        if(themeName) {
            const stylesheetPaths = Util.getThemeDirs()
                .map(dir => '%s/%s/gnome-shell/gnome-shell.css'.format(dir, themeName));

            stylesheetPaths.push(...Util.getModeThemeDirs()
                .map(dir => '%s/%s.css'.format(dir, themeName)));

            stylesheet = stylesheetPaths.find(path => {
                let file = Gio.File.new_for_path(path);
                return file.query_exists(null);
            });
        }

        Main.setThemeStylesheet(stylesheet);
        Main.loadTheme();
    }
}

function init() {
    return new ThemeManager();
}
