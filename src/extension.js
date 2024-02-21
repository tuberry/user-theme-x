// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Field, System} from './const.js';
import {getModeThemeDirs, getThemeDirs, extant} from './theme.js';
import {xnor, noop, fopen, fread, fwrite, mkdir, id, hook, has} from './util.js';
import {Fulu, ExtensionBase, Destroyable, symbiose, omit, connect, disconnect, bindNight, debug} from './fubar.js';

const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const Conf = `${GLib.get_user_config_dir()}/gnome-shell`;
const Sheet = {LIGHT: `${Conf}/gnome-shell-light.css`, DARK: `${Conf}/gnome-shell-dark.css`};

const sync = (s1, k1, s2, k2) => s1.get_string(k1) !== s2.get_string(k2) && s2.set_string(k2, s1.get_string(k1));
const genBgXML = (lpic, dpic) => `<?xml version="1.0"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
    <wallpaper deleted="false">
        <name>user-theme-x</name>
        <filename>${lpic}</filename>
        <filename-dark>${dpic}</filename-dark>
        <options>zoom</options>
        <shade_type>solid</shade_type>
        <pcolor>#ffffff</pcolor>
        <scolor>#000000</scolor>
    </wallpaper>
</wallpapers>`;

class UserThemeX extends Destroyable {
    constructor(gset) {
        super();
        this._buildWidgets(gset);
        this._bindSettings();
    }

    _buildWidgets(gset) {
        this.gset = gset;
        this.gset_t = new Gio.Settings({schema: 'org.gnome.desktop.interface'});
        this._sbt = symbiose(this, () => omit(this, 'style', 'shell'), {
            watch: [x => x && x.cancel(),  x => x && hook({
                changed: (...xs) => xs[3] === Gio.FileMonitorEvent.CHANGED && this._loadStyle(),
            }, fopen(Conf).monitor(Gio.FileMonitorFlags.WATCH_MOVES, null))],
        });
    }

    _bindSettings() {
        this._fulu_bg = new Fulu({
            lpic: [System.LPIC, 'string'],
            dpic: [System.DPIC, 'string'],
        }, 'org.gnome.desktop.background', this, 'wallpaper');
        this._fulu = new Fulu({
            style: [Field.STYLE, 'boolean'],
            shell: [System.SHELL, 'string'],
            theme: [Field.THEME, 'boolean'],
        }, this.gset, this).attach({
            paper: [Field.PAPER, 'boolean'],
        }, this, 'wallpaper');
        bindNight(id, this, 'night');
    }

    set night(night) {
        if(this._night === night) return;
        this._night = night;
        if(this._style) this._loadStyle();
        if(this._theme) this._syncTheme();
    }

    set theme(theme) { // sync values: 5 sys <=> 10 user
        if(xnor(this._theme, theme)) return;
        if((this._theme = theme)) {
            this._syncTheme();
            let store = (a, b, c, d) => [`changed::${b}`, () => { sync(a, b, c, this._night ? `${d}-night` : d); }],
                fetch = (a, b, c, d) => [`changed::${b}`, () => { if(!this._night) sync(a, b, c, d); },
                    `changed::${b}-night`, () => { if(this._night) sync(a, `${b}-night`, c, d); }];
            connect(this, [this.gset_t, ...Items.flatMap(x => store(this.gset_t, System[x], this.gset, Field[x]))],
                [this.gset, ...Items.flatMap(x => fetch(this.gset, Field[x], this.gset_t, System[x]))
                    .concat(fetch(this.gset, Field.SHELL, this.gset, System.SHELL))
                    .concat(store(this.gset, System.SHELL, this.gset, Field.SHELL))]);
        } else {
            disconnect(this, this.gset, this.gset_t);
        }
    }

    _syncTheme() {
        if(!has(this, '_night')) return;
        Main.layoutManager.screenTransition.run();
        if(this._night) {
            Items.forEach(x => sync(this.gset, `${Field[x]}-night`, this.gset_t, System[x]));
            sync(this.gset, `${Field.SHELL}-night`, this.gset, System.SHELL);
        } else {
            Items.forEach(x => sync(this.gset, Field[x], this.gset_t, System[x]));
            sync(this.gset, Field.SHELL, this.gset, System.SHELL);
        }
    }

    set wallpaper([k, v]) {
        this[k] = v;
        this._writeBgXML().catch(noop);
    }

    async _writeBgXML() {
        if(!(this.paper && this.dpic && this.lpic)) return;
        let dir = GLib.build_filenamev(GLib.get_user_data_dir(), 'gnome-background-properties');
        if(!extant(dir)) await mkdir(dir);
        await fwrite(`${GLib.get_user_data_dir()}/gnome-background-properties/user-theme-x.xml`, genBgXML(this.lpic, this.dpic));
    }

    set style(style) {
        if(xnor(this._style, style)) return;
        this._sbt.watch.revive(style);
        if((this._style = style)) {
            connect(this, [St.ThemeContext.get_for_stage(global.stage), 'changed', () => this._loadStyle(true)]);
            this._loadStyle();
        } else {
            disconnect(this, St.ThemeContext.get_for_stage(global.stage));
            this._unloadStyle();
        }
    }

    async _loadStyle(bubble) {
        if(!has(this, '_night')) return;
        try {
            if(!extant(Conf)) await mkdir(Conf);
            let d_css = fopen(Sheet.DARK),
                l_css = fopen(Sheet.LIGHT),
                sheet = this._night && extant(Sheet.DARK) ? d_css : extant(Sheet.LIGHT) ? l_css : null;
            if(!sheet) debug('$XDG_CONFIG_HOME/gnome-shell/gnome-shell-{light,dark}.css not found');
            let css_md5 = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, (await fread(sheet)).at(0));
            if(!bubble && this._css_md5 === css_md5) return;
            this._css_md5 = css_md5;
            let context = St.ThemeContext.get_for_stage(global.stage),
                old_theme = context.get_theme(),
                sheets = old_theme.get_custom_stylesheets();
            if(!this._style || bubble && sheets[0]?.equal(sheet)) return;
            let {application_stylesheet, default_stylesheet, theme_stylesheet} = old_theme;
            let theme = new St.Theme({application_stylesheet, default_stylesheet, theme_stylesheet});
            theme.load_stylesheet(sheet);
            sheets.forEach(x => !x.equal(l_css) && !x.equal(d_css) && theme.load_stylesheet(x));
            context.set_theme(theme);
        } catch(e) {
            logError(e);
        }
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        Object.values(Sheet).forEach(x => theme.unload_stylesheet(fopen(x)));
        this._css_md5 = null;
    }

    set shell(shell) {
        if(this._shell === shell) return;
        this._shell = shell;
        let stylesheet = shell ? getThemeDirs().map(x => `${x}/${shell}/gnome-shell/gnome-shell.css`)
            .concat(getModeThemeDirs().map(x => `${x}/${shell}.css`)).find(x => extant(x)) ?? null : null;
        debug('Load user theme: ', stylesheet);
        Main.setThemeStylesheet(stylesheet);
        Main.loadTheme();
    }
}

export default class Extension extends ExtensionBase { $klass = UserThemeX; }
