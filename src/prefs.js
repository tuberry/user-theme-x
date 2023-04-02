// vim:fdm=syntax
// by tuberry
/* exported init buildPrefsWidget */
'use strict';

const { Adw, Gio, GObject, Gtk, Gdk, GdkPixbuf } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { _, _GTK, noop, gparam, grect } = Me.imports.util;
const { Field, System } = Me.imports.const;
const Theme = Me.imports.theme;
const UI = Me.imports.ui;

const Color = ['default', 'prefer-dark', 'prefer-light'];
const Icon = { SUN: 'weather-clear-symbolic', MOON: 'weather-clear-night-symbolic' };

function init() {
    ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    return new UserThemeXPrefs();
}

class StrDrop extends UI.Box {
    static {
        GObject.registerClass({
            Properties: {
                active: gparam('string', 'active', ''),
            },
        }, this);
    }

    constructor(opts, icon_name, tip) {
        super();
        this._opts = opts;
        let btn = new Gtk.Button({ icon_name, tooltip_text: tip || '' });
        this._drop = new Gtk.DropDown({ model: Gtk.StringList.new(opts) });
        this._drop.connect('notify::selected', () => this.notify('active'));
        btn.connect('clicked', () => this._drop.activate());
        [btn, this._drop].forEach(x => this.append(x));
    }

    vfunc_mnemonic_activate() {
        this._drop.activate();
    }

    set active(active) {
        let index = this._opts.indexOf(active);
        this._drop.set_selected(index > 0 ? index : 0);
    }

    get active() {
        return this._opts[this._drop.get_selected() || 0];
    }
}

class ImgBtn extends Gtk.Button {
    static {
        GObject.registerClass({
            Properties: {
                value: gparam('string', 'value', ''),
            },
        }, this);
    }

    constructor(title, icon, h) {
        super({ height_request: h || 360 });
        this.add_css_class('suggested-action');
        this.set_child(new Gtk.Image({ icon_name: icon || 'document-open-symbolic', icon_size: Gtk.IconSize.LARGE }));
        this.connect('clicked', () => this._dlg.open(this.get_root(), null).then(x => { this.value = x.get_path(); }).catch(noop));
        this._dlg = new Gtk.FileDialog({ modal: true, title: title || _GTK('File'), default_filter: new Gtk.FileFilter() });
        this._dlg.default_filter.add_pixbuf_formats();
    }
}

class Thumb extends Adw.Bin {
    static {
        GObject.registerClass({
            Properties: {
                dark:  gparam('string', 'dark', ''),
                light: gparam('string', 'light', ''),
            },
        }, this);
    }

    constructor(w, h) {
        super({ width_request: w || 640,  height_request: h || 360 });
        this.connect('notify::light', () => this.queue_draw());
        this.connect('notify::dark', () => this.queue_draw());
    }

    _snapshot(ss, w, h, left) {
        let cr = ss.append_cairo(grect(w, h));
        try {
            let file = left ? this.light : this.dark,
                pix = GdkPixbuf.Pixbuf.new_from_file(file.replace(/^file:\/\//, '')),
                [W, H] = [pix.get_width(), pix.get_height()],
                s = Math.max(w / W, h / H);
            Gdk.cairo_set_source_pixbuf(cr, pix.scale_simple(W * s, H * s, GdkPixbuf.InterpType.BILINEAR), 0, 0);
            cr.moveTo(0, 0);
            cr.lineTo(w, h);
            left ? cr.lineTo(0, h) : cr.lineTo(w, 0);
            cr.clip();
            cr.paint();
        } catch(e) {
            let c = left ? 0.9 : 0.14;
            cr.setSourceRGBA(c, c, c, 1);
            cr.moveTo(0, 0);
            cr.lineTo(w, h);
            left ? cr.lineTo(0, h) : cr.lineTo(w, 0);
            cr.fill();
        }
        cr.$dispose();
    }

    vfunc_snapshot(snapshot) {
        let [w, h] = this.get_size_request();
        [true, false].forEach(x => this._snapshot(snapshot, w, h, x));
    }
}

class Wall extends Adw.PreferencesRow {
    static {
        GObject.registerClass(this);
    }

    constructor(w, h) {
        super();
        let thumb = new Thumb(w, h),
            dgset = new Gio.Settings({ schema: 'org.gnome.desktop.background' }),
            [light, dark] = [[_('Day'), Icon.SUN, 'light', System.LPIC], [_('Night'), Icon.MOON, 'dark', System.DPIC]].map(x => {
                let btn = new ImgBtn(x[0], x[1], h);
                btn.bind_property('value', thumb, x[2], GObject.BindingFlags.DEFAULT);
                dgset.bind(x[3], btn, 'value', Gio.SettingsBindFlags.DEFAULT);
                return btn;
            });
        this.set_child(new UI.Box([light, thumb, dark]));
    }
}

class UserThemeXPrefs extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super();
        this._buildWidgets().then(() => this._buildUI());
    }

    async _buildWidgets() {
        let themes = await Theme.getAllThemes();
        let gset = ExtensionUtils.getSettings();
        this._blk = UI.block({
            STYLE: ['active', new Gtk.CheckButton()],
            PAPER: ['enable-expansion', new Adw.ExpanderRow({ title: _('Wallpaper'), show_enable_switch: true })],
            NIGHT: ['enable-expansion', new Adw.ExpanderRow({ title: _('Themes'), show_enable_switch: true, subtitle: _('Switch according to the Night Light in the Settings') })],
        }, gset);
        this._wdg = [Color, ...themes].map(x => [[Icon.SUN, _('Day')], [Icon.MOON, _('Night')]].map(y => new StrDrop(x, ...y)));
        ['COLOR', 'GTK', 'SHELL', 'ICONS', 'CURSOR'].forEach((x, i) => {
            gset.bind(Field[x], this._wdg[i][0], 'active', Gio.SettingsBindFlags.DEFAULT);
            gset.bind(`${Field[x]}-night`, this._wdg[i][1], 'active', Gio.SettingsBindFlags.DEFAULT);
        });
    }

    _buildUI() {
        this._blk.PAPER.add_row(new Wall(480, 270));
        [_('Style'), _('Gtk3'), _('Shell'), _('Icons'), _('Cursor')].forEach((x, i) => this._blk.NIGHT.add_row(new UI.PrefRow([x], ...this._wdg[i])));
        this.add(new UI.PrefRow(this._blk.STYLE, [_('Stylesheet'), _('Load from “~/.config/gnome-shell/gnome-shell{,-dark}.css”')]));
        ['NIGHT', 'PAPER'].forEach(x => { this.add(this._blk[x]); this._blk[x].enable_expansion && this._blk[x].set_expanded(true); });
    }
}
