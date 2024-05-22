// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Field, System} from './const.js';
import {noop, fopen, fread, fwrite, mkdir, has} from './util.js';
import {getModeThemeDirs, getThemeDirs, extant} from './theme.js';
import {Setting, Extension, Mortal, Source, connect, debug} from './fubar.js';

const ThemeContext = St.ThemeContext.get_for_stage(global.stage);

const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const Config = `${GLib.get_user_config_dir()}/gnome-shell`;
const Sheet = {LIGHT: `${Config}/gnome-shell-light.css`, DARK: `${Config}/gnome-shell-dark.css`};

const syncStr = (s1, k1, s2, k2) => (v => v !== s2.get_string(k2) && s2.set_string(k2, v))(s1.get_string(k1));
const genBgXML = (lightPic, darkPic) => `<?xml version="1.0"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
    <wallpaper deleted="false">
        <name>user-theme-x</name>
        <filename>${lightPic}</filename>
        <filename-dark>${darkPic}</filename-dark>
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
    }

    $buildWidgets(gset) {
        this.$set = new Setting(null, gset, this);
        this.$src = Source.fuse({
            theme: new Source(() => this.$syncTheme()),
            light: Source.newLight(x => this.$onLightSet(x), true),
            style: new Source(() => this.$loadStyle(), () => this.$unloadStyle()),
            shell: new Source(x => this.loadShellTheme(x), () => this.loadShellTheme()),
            stage: Source.newHandler(ThemeContext, 'changed', () => this.loadStyle(true)),
            watch: Source.newMonitor(Config, (...xs) => xs[3] === Gio.FileMonitorEvent.CHANGED && this.loadStyle()),
            paper: Source.newSetting({
                darkPic: [System.DPIC, 'string', x => { if(x !== this.darkPic) this.savePaper({darkPic: x}).catch(noop); }],
                lightPic: [System.LPIC, 'string', x => { if(x !== this.lightPic) this.savePaper({lightPic: x}).catch(noop); }],
            }, 'org.gnome.desktop.background', this),
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

    async savePaper({darkPic = this.darkPic, lightPic = this.lightPic}) {
        if(!this.darkPic || !this.lightPic) return;
        let dir = `${GLib.get_user_data_dir()}/gnome-background-properties`;
        if(!extant(dir)) await mkdir(dir);
        await fwrite(`${GLib.get_user_data_dir()}/gnome-background-properties/user-theme-x.xml`, genBgXML(lightPic, darkPic));
    }

    $syncTheme() { // sync values: 5 sys <=> 10 user
        let {gset} = this.$set,
            hub = new Mortal(),
            dset = new Gio.Settings({schema: 'org.gnome.desktop.interface'}),
            store = (a, b, c, d) => [`changed::${b}`, () => { syncStr(a, b, c, this.night ? `${d}-night` : d); }],
            fetch = (a, b, c, d) => [`changed::${b}`, () => { if(!this.night) syncStr(a, b, c, d); },
                `changed::${b}-night`, () => { if(this.night) syncStr(a, `${b}-night`, c, d); }];
        this.syncTheme = () => {
            if(!has(this, 'night')) return;
            if(this.night) {
                Items.forEach(x => syncStr(gset, `${Field[x]}-night`, dset, System[x]));
                syncStr(gset, `${Field.SHELL}-night`, gset, System.SHELL);
            } else {
                Items.forEach(x => syncStr(gset, Field[x], dset, System[x]));
                syncStr(gset, Field.SHELL, gset, System.SHELL);
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
        this.loadStyle().then(() => this.$src.stage.toggle(true));
    }

    async loadStyle(bubble) {
        if(!has(this, 'night')) return;
        try {
            if(!extant(Config)) await mkdir(Config);
            let darkCss = fopen(Sheet.DARK),
                lightCss = fopen(Sheet.LIGHT),
                sheet = this.night && extant(Sheet.DARK) ? darkCss : extant(Sheet.LIGHT) ? lightCss : null;
            if(!sheet) throw Error('$XDG_CONFIG_HOME/gnome-shell/gnome-shell-{light,dark}.css not found');
            let styleMd5 = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, (await fread(sheet)).at(0));
            if(!this.$src.watch?.active || !bubble && this.$styleMd5 === styleMd5) return;
            this.$styleMd5 = styleMd5;
            let oldTheme = ThemeContext.get_theme();
            let sheets = oldTheme.get_custom_stylesheets();
            if(bubble && sheets[0]?.equal(sheet)) return;
            let {application_stylesheet, default_stylesheet, theme_stylesheet} = oldTheme;
            let theme = new St.Theme({application_stylesheet, default_stylesheet, theme_stylesheet});
            theme.load_stylesheet(sheet);
            sheets.forEach(x => !x.equal(lightCss) && !x.equal(darkCss) && theme.load_stylesheet(x));
            ThemeContext.set_theme(theme);
        } catch(e) {
            logError(e);
        }
    }

    $unloadStyle() {
        this.$src.watch.toggle(false);
        this.$src.stage.toggle(false);
        let theme = ThemeContext.get_theme();
        Object.values(Sheet).forEach(x => theme.unload_stylesheet(fopen(x)));
        delete this.$styleMd5;
    }

    loadShellTheme(theme) {
        let sheet = theme ? getThemeDirs().map(x => `${x}/${theme}/gnome-shell/gnome-shell.css`)
            .concat(getModeThemeDirs().map(x => `${x}/${theme}.css`)).find(x => extant(x)) : undefined;
        if(Main.getThemeStylesheet()?.get_path() === sheet) return;
        if(theme) debug('Load user theme: ', theme);
        Main.setThemeStylesheet(sheet);
        Main.loadTheme();
    }
}

export default class MyExtension extends Extension { $klass = UserThemeX; }
