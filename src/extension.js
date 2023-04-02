// vim:fdm=syntax
// by tuberry
/* exported init */

const Main = imports.ui.main;
const { Gio, GLib, St } = imports.gi;
const LightProxy = Main.panel.statusArea.quickSettings._nightLight._proxy;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { xnor, noop, fl, fread, fwrite, fcheck, fexist, dtouch, gerror } = Me.imports.util;
const { Fulu, Extension, DEventEmitter, symbiose, omit, onus } = Me.imports.fubar;
const { Field, System } = Me.imports.const;
const Theme = Me.imports.theme;

const conf = (...xs) => fl(GLib.get_user_config_dir(), ...xs);
const sync = (s1, k1, s2, k2) => s1.get_string(k1) !== s2.get_string(k2) && s2.set_string(k2, s1.get_string(k1));

const Sheet = { LIGHT: 'gnome-shell.css', DARK: 'gnome-shell-dark.css' };
const Items = ['GTK', 'ICONS', 'COLOR', 'CURSOR'];
const genXML = (light, dark) => `<?xml version="1.0"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
    <wallpaper deleted="false">
        <name>user-theme-x</name>
        <filename>${light}</filename>
        <filename-dark>${dark}</filename-dark>
        <options>zoom</options>
        <pcolor>#ffffff</pcolor>
        <scolor>#000000</scolor>
    </wallpaper>
</wallpapers>`;

class UserThemeX extends DEventEmitter {
    constructor() {
        super();
        this._buildWidgets();
        this._bindSettings();
        this._syncNightLight();
    }

    _buildWidgets() {
        this.gset = ExtensionUtils.getSettings();
        this.gset_t = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        this._sbt = symbiose(this, () => omit(this, 'style', 'shell'), {
            watch: [x => x && x.cancel(),  x => x && conf('gnome-shell').monitor(Gio.FileMonitorFlags.WATCH_MOVES, null)],
        });
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
        LightProxy.connectObject('g-properties-changed', () => this._syncNightLight(), onus(this));
    }

    _syncNightLight() {
        if(LightProxy.NightLightActive === null) return;
        this.night_light = LightProxy.NightLightActive;
        if(this._style) this._loadStyle().catch(noop);
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
            this.gset.connectObject(...Items.flatMap(x => fetch(this.gset, Field[x], this.gset_t, System[x]))
                                    .concat(fetch(this.gset, Field.SHELL, this.gset, System.SHELL))
                                    .concat(store(this.gset, System.SHELL, this.gset, Field.SHELL)), onus(this));
            this.gset_t.connectObject(...Items.flatMap(x => store(this.gset_t, System[x], this.gset, Field[x])), onus(this));
        } else {
            ['gset', 'gset_t'].forEach(x => this[x].disconnectObject(onus(this)));
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
        let dir = fl(GLib.get_user_data_dir(), 'gnome-background-properties');
        if(!await fexist(dir)) await dtouch(dir);
        await fwrite(fl(GLib.get_user_data_dir(), 'gnome-background-properties', 'user-theme-x-wallpaper.xml'), genXML(this.lpic, this.dpic));
    }

    set style(style) {
        if(xnor(this._style, style)) return;
        this._sbt.watch.revive(style)?.connect?.('changed', (...xs) => xs[3] === Gio.FileMonitorEvent.CHANGED && this._loadStyle().catch(noop));
        if((this._style = style)) this._loadStyle().catch(noop);
        else this._unloadStyle();
    }

    async _loadStyle() {
        let light = conf('gnome-shell', Sheet.LIGHT),
            dark = conf('gnome-shell', Sheet.DARK),
            style = this.isNight() && await fexist(dark) ? dark : await fexist(light) ? light : null;
        if(!style) throw gerror('NOT_FOUND', 'No custom stylesheet found');
        let style_md5 = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, (await fread(style)).at(1));
        if(this._style_md5 === style_md5) return;
        this._style_md5 = style_md5;
        let ctx = St.ThemeContext.get_for_stage(global.stage);
        let thm = new St.Theme({ application_stylesheet: Main.getThemeStylesheet(), default_stylesheet: Main._getDefaultStylesheet() });
        ctx.get_theme()?.get_custom_stylesheets().forEach(x => !x.equal(light) && !x.equal(dark) && thm.load_stylesheet(x));
        thm.load_stylesheet(style);
        ctx.set_theme(thm);
    }

    _unloadStyle() {
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        if(theme) Object.values(Sheet).forEach(x => theme.unload_stylesheet(conf('gnome-shell', x)));
    }

    set shell(shell) {
        if(this._shell === shell) return;
        if((this._shell = shell)) {
            let paths = Theme.getThemeDirs().map(x => `${x}/${shell}/gnome-shell/gnome-shell.css`)
                .concat(Theme.getModeThemeDirs().map(x => `${x}/${shell}.css`));
            Promise.any(paths.map(async x => await fcheck(x) && x))
                .then(this._loadShellTheme.bind(this)).catch(() => this._loadShellTheme(null));
        } else {
            this._loadShellTheme(null);
        }
    }

    _loadShellTheme(stylesheet) {
        try {
            Main.setThemeStylesheet(stylesheet);
            Main.loadTheme();
        } catch(e) {
            // ignore
        }
    }
}

function init() {
    return new Extension(UserThemeX);
}
