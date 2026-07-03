// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import St from 'gi://St';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as T from './util.js';
import * as F from './fubar.js';

import {getShellThemePath} from './theme.js';
import {Key as K, LIGHT, DARK} from './const.js';

const {$, $_, $$} = T;

const Theme = {
    GTK: 'gtk-theme',
    ICON: 'icon-theme',
    COLOR: 'accent-color',
    STYLE: 'color-scheme',
    CURSOR: 'cursor-theme',
};

const Themes = Object.keys(Theme);

class UserThemeX extends F.Mortal {
    $bindSettings(gset) {
        this.$set = new F.Setting(gset).tie(this, [
            [K.SHELL, null, x => this.$src.shell.toggle(x)],
            [K.SHEET, null, x => this.$src.sheet.toggle(x)],
        ], Themes.map(x => [[x, K[x]]]), () => {
            this.$theme = Themes.filter(x => this[x]);
        }, () => this.$src.theme.switch(this.theme));
    }

    $buildSources() {
        let theme = new F.Source(() => this.$genThemeSyncer(), this.theme),
            shell = new F.Source(() => this.$genShellSyncer(), this[K.SHELL]),
            sheet = new F.Source(() => this.$genSheetSyncer(), this[K.SHEET]),
            light = new F.Source.Proxy('org.gnome.SettingsDaemon.Color', '/org/gnome/SettingsDaemon/Color', x => this.$onLightOn(x),
                ['g-properties-changed', (x, p) => { if(p.lookup_value('NightLightActive', null)) this.$onLightOn(x); }]);
        this.$src = F.Source.tie(this, {theme, shell, sheet}, light);
    }

    get theme() { return this.$theme.length > 0; }

    get active() { return Object.hasOwn(this, 'night'); }

    $onLightOn({NightLightActive: night}) { // NOTE: https://gitlab.gnome.org/GNOME/gnome-control-center/-/issues/2060
        if(this.night === night || night === null) return;
        this.night = night;
        ['sheet', 'theme', 'shell'].forEach(x => this.$src[x].hub?.sync());
    }

    $genSheetSyncer() {
        let ret = new F.Mortal();
        this.$set.tie(ret, [
            [['dark', `${DARK}${K.SHEET}`], null, x => this.night && ret.$src.load.summon(x)],
            [['light', `${LIGHT}${K.SHEET}`], null, x => this.night || ret.$src.load.summon(x)],
        ]);
        let load = new F.Source((path, bubble) => {
                if(!this.active) return;
                try {
                    let sheet = T.fopen(path),
                        context = F.theme(),
                        theme = context.get_theme(),
                        sheets = theme.get_custom_stylesheets();
                    if(!(bubble && sheets[0]?.equal(sheet))) {
                        let {application_stylesheet, default_stylesheet, theme_stylesheet} = theme;
                        theme = new St.Theme({application_stylesheet, default_stylesheet, theme_stylesheet})[$].load_stylesheet(sheet);
                        sheets.forEach(x => sheet.equal(x) || load.hub?.equal(x) || theme.load_stylesheet(x));
                        context.set_theme(theme);
                        if(!load.hub?.equal(sheet)) ret.$src.watch.revive(sheet);
                        ret.$src.theme.revive(theme);
                    }
                    return sheet;
                } catch {
                    Object.values(ret.$src).forEach(x => x.dispel());
                }
            }, x => x && F.theme().get_theme().unload_stylesheet(x)),
            delay = new F.Source.Timer(x => [() => load.summon(load.hub, x), 100]), // debounce
            theme = new F.Source(x => new F.Source.Handler(x, 'custom-stylesheets-changed', () => delay.revive())),
            watch = new F.Source(x => new F.Source.Monitor(x, (...xs) => delay[$$].revive(xs[3] === Gio.FileMonitorEvent.CHANGES_DONE_HINT && [[false]]), true));
        return ret.set({
            $src: F.Source.tie(ret, {theme, watch, delay, load}),
            sync: (() => load.summon(this.night ? ret.dark : ret.light))[$].call(),
        });
    }

    $genThemeSyncer() {
        let ret = new F.Mortal(),
            gset = this.$set.hub,
            dset = new Gio.Settings({schema: 'org.gnome.desktop.interface'}),
            sync = (s0, k0, s1, k1) => { this.active && (v => v !== s1.get_string(k1) && s1.set_string(k1, v))(s0.get_string(k0)); },
            store = x => [`changed::${Theme[x]}`, () => sync(dset, Theme[x], gset, `${this.night ? DARK : LIGHT}${K[x]}`)],
            fetch = x => [`changed::${LIGHT}${K[x]}`, () => { if(!this.night) sync(gset, `${LIGHT}${K[x]}`, dset, Theme[x]); },
                `changed::${DARK}${K[x]}`, () => { if(this.night) sync(gset, `${DARK}${K[x]}`, dset, Theme[x]); }];
        F.Source.tie(ret, new F.Source.Handler(dset, ...this.$theme.flatMap(store), gset, ...this.$theme.flatMap(fetch)));
        return ret.set({sync: (() => this.$theme.forEach(x => sync(gset, `${this.night ? DARK : LIGHT}${K[x]}`, dset, Theme[x])))[$].call()});
    }

    $genShellSyncer() {
        let ret = new F.Mortal(),
            load = theme => {
                let path = theme ? getShellThemePath(theme) ?? null : null;
                if(Main.getThemeStylesheet()?.get_path() === path) return;
                Main.setThemeStylesheet(path);
                Main.loadTheme();
            },
            src = F.Source.tie(ret, new F.Source(x => this.active && x[$_](load), x => x && load()));
        this.$set.tie(ret, [
            [['dark', `${DARK}${K.SHELL}`], null, x => this.night && src.summon(x)],
            [['light', `${LIGHT}${K.SHELL}`], null, x => this.night || src.summon(x)],
        ]);
        return ret.set({sync: (() => src.summon(this.night ? ret.dark : ret.light))[$].call()});
    }
}

export default class extends F.Extension { $klass = UserThemeX; }
