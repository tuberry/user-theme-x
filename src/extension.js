// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import St from 'gi://St';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as T from './util.js';
import * as F from './fubar.js';

import {getShellThemePath} from './theme.js';
import {Key as K, LIGHT, DARK} from './const.js';

const {$, $_} = T;

const Theme = {
    GTK: 'gtk-theme',
    ICON: 'icon-theme',
    COLOR: 'accent-color',
    STYLE: 'color-scheme',
    CURSOR: 'cursor-theme',
};

const Themes = Object.keys(Theme);

class UserThemeX extends F.Mortal {
    constructor(gset) {
        super()[$].$bindSettings(gset)[$].$buildSources();
    }

    $bindSettings(gset) {
        this.$set = new F.Setting(gset, [
            [K.SHELL, null, x => this.$src.shell.toggle(x)],
            [K.SHEET, null, x => this.$src.sheet.toggle(x)],
        ], this).tie(Themes.map(x => [[x, K[x]]]), this, () => {
            this.$theme = Themes.filter(x => this[x]);
        }, () => this.$src.theme.switch(this.theme));
    }

    $buildSources() {
        let theme = F.Source.new(() => this.#genThemeSyncer(), this.theme),
            shell = F.Source.new(() => this.#genShellSyncer(), this[K.SHELL]),
            sheet = F.Source.new(() => this.#genSheetSyncer(), this[K.SHEET]),
            light = F.Source.new(() => new F.DBusProxy('org.gnome.SettingsDaemon.Color', '/org/gnome/SettingsDaemon/Color', x => this.#onLightOn(x),
                ['g-properties-changed', (x, p) => { if(p.lookup_value('NightLightActive', null)) this.#onLightOn(x); }]), true);
        this.$src = F.Source.tie({theme, shell, sheet, light}, this);
    }

    get theme() {
        return this.$theme.length > 0;
    }

    get active() {
        return Object.hasOwn(this, 'night');
    }

    #onLightOn({NightLightActive: night}) { // NOTE: https://gitlab.gnome.org/GNOME/gnome-control-center/-/issues/2510
        if(this.night === night) return;
        this.night = night;
        ['sheet', 'theme', 'shell'].forEach(x => this.$src[x].hub?.sync());
    }

    #genSheetSyncer() {
        let ret = new F.Mortal();
        let load = (path, bubble = true) => {
            if(path) {
                try {
                    let sheet = T.fopen(path),
                        context = F.theme(),
                        theme = context.get_theme(),
                        sheets = theme.get_custom_stylesheets();
                    if(bubble && sheets[0]?.equal(sheet)) return;
                    let {application_stylesheet, default_stylesheet, theme_stylesheet} = theme;
                    theme = new St.Theme({application_stylesheet, default_stylesheet, theme_stylesheet})[$].load_stylesheet(sheet); // exception
                    sheets.forEach(x => !sheet.equal(x) && !ret.sheet?.equal(x) && theme.load_stylesheet(x));
                    if(!ret.sheet?.equal(sheet)) ret.$src.watch.revive(ret.sheet = sheet);
                    ret.$src.theme.revive(theme);
                    context.set_theme(theme);
                } catch(e) {
                    logError(e);
                    load();
                }
            } else if(ret.sheet) {
                Object.values(ret.$src).forEach(x => x.dispel());
                F.theme().get_theme().unload_stylesheet(ret.sheet);
                delete ret.sheet;
            }
        };
        this.$set.tie([
            [['dark', `${DARK}${K.SHEET}`], null, x => this.active && this.night && load(x)],
            [['light', `${LIGHT}${K.SHEET}`], null, x => this.active && !this.night && load(x)],
        ], ret);
        let delay = F.Source.newTimer(x => [() => ret.sheet && load(ret.sheet, x), 100]), // debounce
            theme = F.Source.new(x => F.Source.newHandler(x, 'custom-stylesheets-changed', () => delay.revive(), true)),
            watch = F.Source.new(x => F.Source.newMonitor(x, (...xs) => delay[$_].revive(xs[3] === Gio.FileMonitorEvent.CHANGES_DONE_HINT, false), true));
        return ret[$].$src(F.Source.tie({theme, watch, delay}, ret))[$]
            .sync((() => this.active && load(this.night ? ret.dark : ret.light))[$].call())[$]
            .connect('destroy', () => load()); // clear
    }

    #genThemeSyncer() {
        let ret = new F.Mortal(),
            gset = this.$set.hub,
            dset = new Gio.Settings({schema: 'org.gnome.desktop.interface'}),
            sync = (s0, k0, s1, k1) => void (v => v !== s1.get_string(k1) && s1.set_string(k1, v))(s0.get_string(k0)),
            store = x => [`changed::${Theme[x]}`, () => sync(dset, Theme[x], gset, `${this.night ? DARK : LIGHT}${K[x]}`)],
            fetch = x => [`changed::${LIGHT}${K[x]}`, () => { if(!this.night) sync(gset, `${LIGHT}${K[x]}`, dset, Theme[x]); },
                `changed::${DARK}${K[x]}`, () => { if(this.night) sync(gset, `${DARK}${K[x]}`, dset, Theme[x]); }];
        ret.sync = (() => this.active && this.$theme.forEach(x => sync(gset, `${this.night ? DARK : LIGHT}${K[x]}`, dset, Theme[x])))[$].call();
        F.connect(ret, dset, ...this.$theme.flatMap(x => store(x)), gset, ...this.$theme.flatMap(x => fetch(x)));
        return ret;
    }

    #genShellSyncer() {
        let ret = new F.Mortal();
        let load = theme => {
            let path = theme ? getShellThemePath(theme) : null;
            if(Main.getThemeStylesheet()?.get_path() === path) return;
            if(theme) F.debug('Loading user theme: ', theme);
            Main[$].setThemeStylesheet(path).loadTheme();
        };
        this.$set.tie([
            [['dark', `${DARK}${K.SHELL}`], null, x => this.active && this.night && load(x)],
            [['light', `${LIGHT}${K.SHELL}`], null, x => this.active && !this.night && load(x)],
        ], ret);
        ret.sync = (() => this.active && load(this.night ? ret.dark : ret.light))[$].call();
        ret.connect('destroy', () => load()); // clear
        return ret;
    }
}

export default class extends F.Extension { $klass = UserThemeX; }
