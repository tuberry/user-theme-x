// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Field, System} from './const.js';
import {getModeThemeDirs, getThemeDirs, extant} from './theme.js';
import {noop, fopen, fread, fwrite, mkdir, hook, has} from './util.js';
import {Setting, Extension, Mortal, Source, Light, degrade, connect, disconnect, debug} from './fubar.js';

const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const Conf = `${GLib.get_user_config_dir()}/gnome-shell`;
const Sheet = {LIGHT: `${Conf}/gnome-shell-light.css`, DARK: `${Conf}/gnome-shell-dark.css`};
const ThemeContext = St.ThemeContext.get_for_stage(global.stage);

const sync = (s1, k1, s2, k2) => (v => v !== s2.get_string(k2) && s2.set_string(k2, v))(s1.get_string(k1));
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

class UserThemeX extends Mortal {
    constructor(gset) {
        super();
        this.$buildWidgets(gset);
        this.$bindSettings();
        this.$src.light.summon();
    }

    $buildWidgets(gset) {
        this.$set = new Setting(null, gset, this);
        this.$src = degrade({
            light: new Light(x => this.$onLightSet(x)),
            theme: new Source(() => this.$syncTheme()),
            paper: new Source(() => this.$syncPaper(), x => x?.detach(this)),
            style: new Source(() => this.$loadStyle(), () => this.$unloadStyle()),
            shell: new Source(x => this.loadShellTheme(x), () => this.loadShellTheme()),
            watch: new Source(() => hook({
                changed: (...xs) => xs[3] === Gio.FileMonitorEvent.CHANGED && this.loadStyle(),
            }, fopen(Conf).monitor(Gio.FileMonitorFlags.WATCH_MOVES, null)),  x => x?.cancel()),
        }, this);
    }

    $bindSettings() {
        this.$set.attach({
            style: [Field.STYLE, 'boolean', x => this.$src.style.toggle(x)],
            shell: [System.SHELL, 'string', x => this.$src.shell.summon(x)],
            theme: [Field.THEME, 'boolean', x => this.$src.theme.toggle(x)],
            paper: [Field.PAPER, 'boolean', x => this.$src.paper.toggle(x)],
        }, this);
    }

    $onLightSet(night) {
        if(this.night === night) return;
        this.night = night;
        if(this.style) this.loadStyle();
        if(this.theme) this.syncTheme();
    }

    $syncPaper() {
        let hub = new Setting({
            lpic: [System.LPIC, 'string', x => { if(x !== this.lpic) this.savePaper({lpic: x}).catch(noop); }],
            dpic: [System.DPIC, 'string', x => { if(x !== this.dpic) this.savePaper({dpic: x}).catch(noop); }],
        }, 'org.gnome.desktop.background', this);
        return hub;
    }

    async savePaper({dpic = this.dpic, lpic = this.lpic}) {
        if(!dpic || !lpic) return;
        let dir = GLib.build_filenamev(GLib.get_user_data_dir(), 'gnome-background-properties');
        if(!extant(dir)) await mkdir(dir);
        await fwrite(`${GLib.get_user_data_dir()}/gnome-background-properties/user-theme-x.xml`, genBgXML(lpic, dpic));
    }

    $syncTheme() { // sync values: 5 sys <=> 10 user
        let {gset} = this.$set,
            hub = new Mortal(),
            dset = new Gio.Settings({schema: 'org.gnome.desktop.interface'}),
            store = (a, b, c, d) => [`changed::${b}`, () => { sync(a, b, c, this.night ? `${d}-night` : d); }],
            fetch = (a, b, c, d) => [`changed::${b}`, () => { if(!this.night) sync(a, b, c, d); },
                `changed::${b}-night`, () => { if(this.night) sync(a, `${b}-night`, c, d); }];
        this.syncTheme = () => {
            if(!has(this, 'night')) return;
            if(this.night) {
                Items.forEach(x => sync(gset, `${Field[x]}-night`, dset, System[x]));
                sync(gset, `${Field.SHELL}-night`, gset, System.SHELL);
            } else {
                Items.forEach(x => sync(gset, Field[x], dset, System[x]));
                sync(gset, Field.SHELL, gset, System.SHELL);
            }
        };
        this.syncTheme();
        connect(hub, dset, ...Items.flatMap(x => store(dset, System[x], gset, Field[x])),
            gset, ...Items.flatMap(x => fetch(gset, Field[x], dset, System[x])),
            ...fetch(gset, Field.SHELL, gset, System.SHELL),
            ...store(gset, System.SHELL, gset, Field.SHELL));
        return hub;
    }

    $loadStyle() {
        this.$src.watch.toggle(true);
        connect(this, ThemeContext, 'changed', () => this.loadStyle(true));
        this.loadStyle();
    }

    async loadStyle(bubble) {
        if(!has(this, 'night')) return;
        try {
            if(!extant(Conf)) await mkdir(Conf);
            let d_css = fopen(Sheet.DARK),
                l_css = fopen(Sheet.LIGHT),
                sheet = this.night && extant(Sheet.DARK) ? d_css : extant(Sheet.LIGHT) ? l_css : null;
            if(!sheet) throw Error('$XDG_CONFIG_HOME/gnome-shell/gnome-shell-{light,dark}.css not found');
            let style_md5 = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, (await fread(sheet)).at(0));
            if(!this.$src.watch?.active || !bubble && this.$style_md5 === style_md5) return;
            this.$style_md5 = style_md5;
            let old_theme = ThemeContext.get_theme();
            let sheets = old_theme.get_custom_stylesheets();
            if(bubble && sheets[0]?.equal(sheet)) return;
            let {application_stylesheet, default_stylesheet, theme_stylesheet} = old_theme;
            let theme = new St.Theme({application_stylesheet, default_stylesheet, theme_stylesheet});
            theme.load_stylesheet(sheet);
            sheets.forEach(x => !x.equal(l_css) && !x.equal(d_css) && theme.load_stylesheet(x));
            ThemeContext.set_theme(theme);
        } catch(e) {
            logError(e);
        }
    }

    $unloadStyle() {
        this.$src.watch.toggle(false);
        disconnect(this, ThemeContext);
        let theme = ThemeContext.get_theme();
        Object.values(Sheet).forEach(x => theme.unload_stylesheet(fopen(x)));
        delete this.$style_md5;
    }

    loadShellTheme(theme) {
        let sheet = theme ? getThemeDirs().map(x => `${x}/${theme}/gnome-shell/gnome-shell.css`)
            .concat(getModeThemeDirs().map(x => `${x}/${theme}.css`)).find(x => extant(x)) ?? null : null;
        if(sheet) debug('Load user theme: ', theme);
        Main.setThemeStylesheet(sheet);
        Main.loadTheme();
    }
}

export default class MyExtension extends Extension { $klass = UserThemeX; }
