// vim:fdm=syntax
// by tuberry
/* exported init buildPrefsWidget */
'use strict';

const { Adw, Gio, GObject, Gtk, Gdk, Graphene, GdkPixbuf } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { _, _GTK, genParam } = Me.imports.util;
const { Field, System } = Me.imports.const;
const Theme = Me.imports.theme;
const UI = Me.imports.ui;

const DAY = 'daytime-sunrise-symbolic';
const NIGHT = 'daytime-sunset-symbolic';
const SCHEME = ['default', 'prefer-dark', 'prefer-light'];
const Items = ['COLOR', 'GTK', 'SHELL', 'ICONS', 'CURSOR'];

function init() {
    ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    return new UserThemeXPrefs();
}

function Rect(x, y, width, height) {
    return new Graphene.Rect({ origin: new Graphene.Point({ x, y }), size: new Graphene.Size({ width, height }) });
}

class StrDrop extends Gtk.Box {
    static {
        GObject.registerClass({
            Properties: {
                active:  genParam('string', 'active', ''),
            },
        }, this);
    }

    constructor(opts, icon_name, tip) {
        super({ valign: Gtk.Align.CENTER, css_classes: ['linked'] });
        this._opts = opts;
        let btn = new Gtk.Button({ icon_name, tooltip_text: tip || '' });
        this._drop = new Gtk.DropDown({ model: Gtk.StringList.new(opts) });
        this._drop.connect('notify::selected', () => this.notify('active'));
        [btn, this._drop].forEach(x => this.append(x));
        btn.connect('clicked', () => this._drop.activate());
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
                file: genParam('string', 'file', ''),
            },
        }, this);
    }

    constructor(title, icon, h) {
        super({ css_classes: ['suggested-action'], height_request: h || 360 });
        this._title = title || _GTK('File');
        this.set_child(new Gtk.Image({ icon_name: icon || 'document-open-symbolic', icon_size: Gtk.IconSize.LARGE }));
    }

    vfunc_clicked() {
        let chooser = new Gtk.FileChooserNative({
            title: this._title,
            modal: Gtk.DialogFlags.MODAL,
            action: Gtk.FileChooserAction.OPEN,
        });
        let filter = new Gtk.FileFilter();
        filter.add_mime_type('image/*');
        chooser.add_filter(filter);
        chooser.connect('response', (widget, response) => {
            if(response !== Gtk.ResponseType.ACCEPT) return;
            this.file = widget.get_file().get_path();
        });
        chooser.set_transient_for(this.get_root());
        chooser.show();
    }
}

class Thumb extends Adw.Bin {
    static {
        GObject.registerClass({
            Properties: {
                dark:  genParam('string', 'dark', ''),
                light: genParam('string', 'light', ''),
            },
        }, this);
    }

    constructor(w, h) {
        super({ width_request: w || 640,  height_request: h || 360 });
    }

    set dark(dark) {
        this._dark = dark;
        this.queue_draw();
    }

    get dark() {
        return this._dark ?? '';
    }

    set light(light) {
        this._light = light;
        this.queue_draw();
    }

    get light() {
        return this._light ?? '';
    }

    _snapshot(snap, w, h, left) {
        let cr = snap.append_cairo(Rect(0, 0, w, h));
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
        let box = new Gtk.Box({ css_classes: ['linked'] }),
            thumb = new Thumb(w, h),
            dgsettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' }),
            [light, dark] = [[_('Day'), DAY, 'light', System.LPIC], [_('Night'), NIGHT, 'dark', System.DPIC]].map(x => {
                let btn = new ImgBtn(x[0], x[1], h);
                btn.bind_property('file', thumb, x[2], GObject.BindingFlags.DEFAULT);
                dgsettings.bind(x[3], btn, 'file', Gio.SettingsBindFlags.DEFAULT);
                return btn;
            });
        [light, thumb, dark].forEach(x => box.append(x));
        this.set_child(box);
    }
}

class UserThemeXPrefs extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super();
        this.gset = ExtensionUtils.getSettings();
        this._buildWidgets().then(() => {
            this._bindValues();
            this._buildUI();
        });
    }

    async _buildWidgets() {
        let themes = await Theme.getAllThemes();
        this._wdg = [SCHEME, ...themes].map(x => [[DAY, _('Day')], [NIGHT, _('Night')]].map(y => new StrDrop(x, ...y)));
        this._blk = {
            night: new Adw.ExpanderRow({ title: _('Themes'), show_enable_switch: true, subtitle: _('Switch according to the Night Light in the Settings') }),
            paper: new Adw.ExpanderRow({ title: _('Wallpaper'), show_enable_switch: true }),
            style: new Gtk.CheckButton(),
        };
    }

    _buildUI() {
        this.add(new UI.PrefRow(this._blk.style, [_('Stylesheet'), _('Load from “~/.config/gnome-shell/gnome-shell{,-dark}.css”')]));
        this.add(this._blk.paper);
        this.add(this._blk.night);
        [[_('Style')], [_('Gtk3')], [_('Shell')], [_('Icons')], [_('Cursor')]]
            .forEach((x, i) => this._blk.night.add_row(new UI.PrefRow(x, ...this._wdg[i])));
        this._blk.paper.add_row(new Wall(480, 270));
        ['night', 'paper'].forEach(x => this._blk[x].enable_expansion && this._blk[x].set_expanded(true));
    }

    _bindValues() {
        Items.forEach((x, i) => {
            this.gset.bind(Field[x], this._wdg[i][0], 'active', Gio.SettingsBindFlags.DEFAULT);
            this.gset.bind(`${Field[x]}-night`, this._wdg[i][1], 'active', Gio.SettingsBindFlags.DEFAULT);
        });
        [
            [Field.STYLE, this._blk.style, 'active'],
            [Field.NIGHT, this._blk.night, 'enable-expansion'],
            [Field.PAPER, this._blk.paper, 'enable-expansion'],
        ].forEach(xs => this.gset.bind(...xs, Gio.SettingsBindFlags.DEFAULT));
    }
}
