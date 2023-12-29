// vim:fdm=syntax
// by tuberry

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Theme from './theme.js';
import { Field, System } from './const.js';
import { xnor, noop, fopen, fread, fwrite, fcheck, fexist, mkdir, gerror } from './util.js';
import { Fulu, ExtensionBase, Destroyable, symbiose, omit, connect, disconnect, lightProxy } from './fubar.js';

const conf = (...xs) => fopen(GLib.get_user_config_dir(), ...xs);
const sync = (s1, k1, s2, k2) => s1.get_string(k1) !== s2.get_string(k2) && s2.set_string(k2, s1.get_string(k1));

const Sheet = { LIGHT: 'gnome-shell-light.css', DARK: 'gnome-shell-dark.css' };
const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const genBgXML = (light, dark) => `<?xml version="1.0"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
    <wallpaper deleted="false">
        <name>user-theme-x</name>
        <filename>${light}</filename>
        <filename-dark>${dark}</filename-dark>
        <options>zoom</options>
        <shade_type>solid</shade_type>
        <pcolor>#ffffff</pcolor>
        <scolor>#000000</scolor>
    </wallpaper>
</wallpapers>`;

class UserThemeX extends Destroyable {
    constructor(gset) {
        super();
        this.gset = gset;
        this._buildWidgets();
        this._bindSettings();
    }

    _buildWidgets() {
        this.gset_t = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        this._sbt = symbiose(this, () => omit(this, 'style', 'shell', '_light'), {
            watch: [x => x && x.cancel(),  x => x && conf('gnome-shell').monitor(Gio.FileMonitorFlags.WATCH_MOVES, null)],
        });
        this._light = lightProxy(() => this._syncNightLight(), this);
    }

    _bindSettings() {
        this._fulu = new Fulu({
            night: [Field.NIGHT, 'boolean'],
            style: [Field.STYLE, 'boolean'],
            shell: [System.SHELL, 'string'],
        }, this.gset, this).attach({
            paper: [Field.PAPER, 'boolean'],
        }, this, 'wallpaper');
        this._fulu_d = new Fulu({
            lpic: [System.LPIC, 'string'],
            dpic: [System.DPIC, 'string'],
        }, 'org.gnome.desktop.background', this, 'wallpaper');
    }

    _syncNightLight() {
        if(this._light.NightLightActive === null) return;
        this.night_light = this._light.NightLightActive;
        if(this._style) this._loadStyle();
        if(this._night) this._syncTheme();
    }

    isNight() {
        return this.night_light && this._night;
    }

    set night(night) { // sync values: 5 sys <=> 10 user
        if(xnor(this._night, night)) return;
        if((this._night = night)) {
            this._syncTheme();
            let store = (a, b, c, d) => [`changed::${b}`, () => sync(a, b, c, this.isNight() ? `${d}-night` : d)],
                fetch = (a, b, c, d) => [`changed::${b}`, () => this.isNight() || sync(a, b, c, d),
                    `changed::${b}-night`, () => this.isNight() && sync(a, `${b}-night`, c, d)];
            connect(this, [this.gset_t, ...Items.flatMap(x => store(this.gset_t, System[x], this.gset, Field[x]))],
                [this.gset, ...Items.flatMap(x => fetch(this.gset, Field[x], this.gset_t, System[x]))
                                    .concat(fetch(this.gset, Field.SHELL, this.gset, System.SHELL))
                                    .concat(store(this.gset, System.SHELL, this.gset, Field.SHELL))]);
        } else {
            disconnect(this, this.gset, this.gset_t);
        }
    }

    _syncTheme() {
        if(!('night_light' in this)) return;
        Main.layoutManager.screenTransition.run();
        if(this.isNight()) {
            Items.forEach(x => sync(this.gset, `${Field[x]}-night`, this.gset_t, System[x]));
            sync(this.gset, `${Field.SHELL}-night`, this.gset, System.SHELL);
        } else {
            Items.forEach(x => sync(this.gset, Field[x], this.gset_t, System[x]));
            sync(this.gset, Field.SHELL, this.gset, System.SHELL);
        }
    }

    set wallpaper([k, v]) {
        this[k] = v;
        this._writeToXML().catch(noop);
    }

    async _writeToXML() {
        if(!(this.paper && this.dpic && this.lpic)) return;
        let dir = fopen(GLib.get_user_data_dir(), 'gnome-background-properties');
        if(!await fexist(dir)) await mkdir(dir);
        await fwrite(fopen(GLib.get_user_data_dir(), 'gnome-background-properties', 'user-theme-x-wallpaper.xml'), genBgXML(this.lpic, this.dpic));
    }

    set style(style) {
        if(xnor(this._style, style)) return;
        this._sbt.watch.revive(style)?.connect?.('changed', (...xs) => xs[3] === Gio.FileMonitorEvent.CHANGED && this._loadStyle());
        if((this._style = style)) this._loadStyle();
        else this._unloadStyle();
    }

    async _loadStyle() {
        try {
            let light = conf('gnome-shell', Sheet.LIGHT),
                dark = conf('gnome-shell', Sheet.DARK),
                style = this.isNight() && await fexist(dark) ? dark : await fexist(light) ? light : null;
            if(!style) throw gerror('NOT_FOUND', 'No custom stylesheet found');
            let style_md5 = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, (await fread(style)).at(0));
            if(this._style_md5 === style_md5) return;
            this._style_md5 = style_md5;
            let context = St.ThemeContext.get_for_stage(global.stage);
            let old_theme = context.get_theme();
            let { application_stylesheet, default_stylesheet, theme_stylesheet } = old_theme;
            let new_theme = new St.Theme({ application_stylesheet, default_stylesheet, theme_stylesheet });
            old_theme.get_custom_stylesheets().forEach(x => !x.equal(light) && !x.equal(dark) && new_theme.load_stylesheet(x));
            new_theme.load_stylesheet(style);
            context.set_theme(new_theme);
        } catch(e) {
            logError(e);
        }
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        Object.values(Sheet).forEach(x => theme.unload_stylesheet(conf('gnome-shell', x)));
        this._style_md5 = null;
    }

    set shell(shell) {
        if(this._shell === shell) return;
        if((this._shell = shell)) {
            let paths = Theme.getThemeDirs().map(x => `${x}/${shell}/gnome-shell/gnome-shell.css`)
                .concat(Theme.getModeThemeDirs().map(x => `${x}/${shell}.css`));
            Promise.any(paths.map(async x => await fcheck(x) && x))
                .then(x => this._loadShellTheme(x)).catch(() => this._loadShellTheme(null));
        } else {
            this._loadShellTheme(null);
        }
    }

    _loadShellTheme(stylesheet) {
        Main.setThemeStylesheet(stylesheet);
        Main.loadTheme();
    }
}

export default class Extension extends ExtensionBase { $klass = UserThemeX; }
