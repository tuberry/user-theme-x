// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import St from 'gi://St';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Util from './util.js';
import * as Fubar from './fubar.js';
import {getShellThemePath} from './theme.js';
import {Field, LIGHT, DARK} from './const.js';

const Theme = {
    GTK: 'gtk-theme',
    ICON: 'icon-theme',
    COLOR: 'accent-color',
    STYLE: 'color-scheme',
    CURSOR: 'cursor-theme',
};

class UserThemeX extends Fubar.Mortal {
    constructor(gset) {
        super();
        this.#bindSettings(gset);
        this.#buildSources();
    }

    #bindSettings(gset) {
        this.$set = new Fubar.Setting(gset, {
            shell: [Field.SHELL, 'boolean', null, x => this.$src.shell.toggle(x)],
            sheet: [Field.SHEET, 'boolean', null, x => this.$src.sheet.toggle(x)],
        }, this).attach(Util.omap(
            Theme, ([k]) => [[k, [Field[k], 'boolean']]]
        ), this, () => { this.$theme = Object.keys(Theme).filter(x => this[x]); }, () => this.$src.theme.switch(this.theme));
    }

    #buildSources() {
        let theme = Fubar.Source.new(() => this.#genThemeSyncer(), this.theme),
            shell = Fubar.Source.new(() => this.#genShellSyncer(), this.shell),
            sheet = Fubar.Source.new(() => this.#genSheetSyncer(), this.sheet),
            light = Fubar.Source.newLight(x => this.#onLightOn(x), true);
        this.$src = Fubar.Source.tie({theme, shell, sheet, light}, this);
    }

    get theme() {
        return this.$theme.length > 0;
    }

    get active() {
        return Util.has(this, 'night');
    }

    #onLightOn(night) { // NOTE: https://gitlab.gnome.org/GNOME/gnome-control-center/-/issues/2510
        if(this.night === night) return;
        this.night = night;
        ['sheet', 'theme', 'shell'].forEach(x => this.$src[x].hub?.sync());
    }

    #genSheetSyncer() {
        let hub = new Fubar.Mortal();
        let load = (path, bubble) => {
            if(path) {
                try {
                    let sheet = Util.fopen(path),
                        context = Fubar.getTheme(),
                        theme = context.get_theme(),
                        sheets = theme.get_custom_stylesheets();
                    if(bubble && sheets[0]?.equal(sheet)) return;
                    let {application_stylesheet, default_stylesheet, theme_stylesheet} = theme;
                    theme = new St.Theme({application_stylesheet, default_stylesheet, theme_stylesheet});
                    theme.load_stylesheet(sheet); // exception
                    sheets.forEach(x => !sheet.equal(x) && !hub.sheet?.equal(x) && theme.load_stylesheet(x));
                    if(!hub.sheet?.equal(sheet)) hub.$src.watch.revive(hub.sheet = sheet);
                    hub.$src.theme.revive(theme);
                    context.set_theme(theme);
                } catch(e) {
                    logError(e);
                    load();
                }
            } else if(hub.sheet) {
                Object.values(hub.$src).forEach(x => x.destroy());
                Fubar.getTheme().get_theme().unload_stylesheet(hub.sheet);
                delete hub.sheet;
            }
        };
        this.$set.attach({
            dark: [`${Field.SHEET}${DARK}`, 'string', null, x => this.active && this.night && load(x)],
            light: [`${Field.SHEET}${LIGHT}`, 'string', null, x => this.active && !this.night && load(x)],
        }, hub);
        let delay = Fubar.Source.newTimer(x => [() => hub.sheet && load(hub.sheet, x), 100]), // debounce
            theme = Fubar.Source.new(x => Fubar.Source.newHandler(x, 'custom-stylesheets-changed', () => delay.revive(true), true)),
            watch = Fubar.Source.new(x => Fubar.Source.newMonitor(x, (...xs) => { xs[3] === Gio.FileMonitorEvent.CHANGES_DONE_HINT && delay.revive(); }, true));
        hub.$src = Fubar.Source.tie({theme, watch, delay}, hub);
        hub.sync = Util.thunk(() => this.active && load(this.night ? hub.dark : hub.light));
        hub.connect('destroy', () => load()); // clear
        return hub;
    }

    #genThemeSyncer() {
        let hub = new Fubar.Mortal(),
            gset = this.$set.hub,
            dset = new Gio.Settings({schema: 'org.gnome.desktop.interface'}),
            sync = (s0, k0, s1, k1) => (v => v !== s1.get_string(k1) && s1.set_string(k1, v))(s0.get_string(k0)),
            store = x => [`changed::${Theme[x]}`, () => { sync(dset, Theme[x], gset, `${Field[x]}${this.night ? DARK : LIGHT}`); }],
            fetch = x => [`changed::${Field[x]}${LIGHT}`, () => { if(!this.night) sync(gset, `${Field[x]}${LIGHT}`, dset, Theme[x]); },
                `changed::${Field[x]}${DARK}`, () => { if(this.night) sync(gset, `${Field[x]}${DARK}`, dset, Theme[x]); }];
        hub.sync = Util.thunk(() => this.active && this.$theme.forEach(x => sync(gset, `${Field[x]}${this.night ? DARK : LIGHT}`, dset, Theme[x])));
        Fubar.connect(hub, dset, ...this.$theme.flatMap(x => store(x)), gset, ...this.$theme.flatMap(x => fetch(x)));
        return hub;
    }

    #genShellSyncer() {
        let hub = new Fubar.Mortal();
        let load = theme => {
            let path = theme ? getShellThemePath(theme) : null;
            if(Main.getThemeStylesheet()?.get_path() === path) return;
            if(theme) Fubar.debug('Loading user theme: ', theme);
            Main.setThemeStylesheet(path);
            Main.loadTheme();
        };
        this.$set.attach({
            dark: [`${Field.SHELL}${DARK}`, 'string', null, x => this.active && this.night && load(x)],
            light: [`${Field.SHELL}${LIGHT}`, 'string', null, x => this.active && !this.night && load(x)],
        }, hub);
        hub.sync = Util.thunk(() => this.active && load(this.night ? hub.dark : hub.light));
        hub.connect('destroy', () => load()); // clear
        return hub;
    }
}

export default class Extension extends Fubar.Extension { $klass = UserThemeX; }
