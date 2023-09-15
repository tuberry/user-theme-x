// vim:fdm=syntax
// by tuberry

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';

import * as UI from './ui.js';
import * as Theme from './theme.js';
import { Field, System } from './const.js';
import { gprops, noop, BIND_FULL } from './util.js';

const { _, hook } = UI;

const Color = ['default', 'prefer-dark', 'prefer-light'];
const Icon = { SUN: 'weather-clear-symbolic', MOON: 'weather-clear-night-symbolic' };

class StringDrop extends UI.Drop {
    static {
        GObject.registerClass({
            Properties: gprops({
                value: ['string', ''],
            }),
        }, this);
    }

    constructor(opts, icon_name, tip) {
        super(opts, tip);
        this.set_list_factory(this.factory);
        this.set_factory(hook({
            setup: (_f, x) => x.set_child(new UI.IconLabel(icon_name)),
            bind: (_f, x) => x.get_child().setupContent(null, x.item.string),
        }, new Gtk.SignalListItemFactory()));
        this.bind_property_full('value', this, 'selected', BIND_FULL, (_b, data) => {
            let ret = this.model.get_n_items();
            do ret--; while(ret > -1 && data !== this.model.get_item(ret).string);
            return [ret !== -1, ret];
        }, (_b, data) => [data !== Gtk.INVALID_LIST_POSITION, this.model.get_item(data)?.string]);
    }
}

class Wallpaper extends Adw.PreferencesRow {
    static {
        GObject.registerClass({
            Properties: gprops({
                dark:  ['string', ''],
                light: ['string', ''],
            }),
        }, this);
    }

    constructor(width_request, height_request) {
        super();
        let area = new Gtk.DrawingArea({ width_request, height_request }),
            gset = new Gio.Settings({ schema: 'org.gnome.desktop.background' }),
            [light, dark] = [['light', Icon.SUN, System.LPIC], ['dark', Icon.MOON, System.DPIC]]
                .map(([prop, icon_name, key]) => {
                    gset.bind(key, this, prop, Gio.SettingsBindFlags.DEFAULT);
                    this.connect(`notify::${prop}`, () => area.queue_draw());
                    return hook({
                        clicked: () => this._onClick(prop).then(x => { this[prop] = x.get_path(); }).catch(noop),
                    },  new Gtk.Button({
                        css_classes: ['suggested-action'], height_request,
                        child: new Gtk.Image({ icon_name, icon_size: Gtk.IconSize.LARGE }),
                    }));
                });
        area.set_draw_func(this._drawThumbnail.bind(this));
        this.set_child(new UI.Box([light, area, dark]));
    }

    _buildDialog() {
        this._dlg = new Gtk.FileDialog({ modal: true, default_filter: new Gtk.FileFilter() });
        this._dlg.default_filter.add_pixbuf_formats();
    }

    _onClick(prop) {
        if(!this._dlg) this._buildDialog();
        this._dlg.set_title(prop === 'light' ? _('Day') : _('Night'));
        return this._dlg.open(this.get_root(), null);
    }

    _drawThumbnail(_a, cr, w, h) {
        ['dark', 'light'].forEach(prop => {
            let light = prop === 'light';
            cr.save();
            try {
                let pixbuf = GdkPixbuf.Pixbuf.new_from_file(this[prop].replace(/^file:\/\//, '')),
                    [W, H] = [pixbuf.get_width(), pixbuf.get_height()],
                    scale = Math.max(w / W, h / H);
                Gdk.cairo_set_source_pixbuf(cr, pixbuf.scale_simple(W * scale, H * scale, GdkPixbuf.InterpType.BILINEAR), 0, 0);
            } catch(e) {
                logError(e);
                light ? cr.setSourceRGBA(0.9, 0.9, 0.9, 1) : cr.setSourceRGBA(0.2, 0.2, 0.2, 1);
            } finally {
                cr.moveTo(0, 0);
                cr.lineTo(w, h);
                light ? cr.lineTo(0, h) : cr.lineTo(w, 0);
                cr.clip();
                cr.paint();
            }
            cr.restore();
        });
        cr.$dispose();
    }
}

class UserThemeXPrefs extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(gset) {
        super();
        this._buildWidgets(gset).then(() => this._buildUI());
    }

    async _buildWidgets(gset) {
        let themes = await Theme.getAllThemes();
        this._blk = UI.block({
            STYLE: ['active', new Gtk.CheckButton()],
            PAPER: ['enable-expansion', new Adw.ExpanderRow({ title: _('Wallpaper'), show_enable_switch: true })],
            NIGHT: ['enable-expansion', new Adw.ExpanderRow({ title: _('Themes'), show_enable_switch: true, subtitle: _('Switch according to the Night Light in the Settings') })],
        }, gset);
        this._wdg = [Color, ...themes].map(x => [[Icon.SUN, _('Day')], [Icon.MOON, _('Night')]].map(y => new StringDrop(x, ...y)));
        ['COLOR', 'GTK', 'SHELL', 'ICONS', 'CURSOR'].forEach((x, i) => {
            gset.bind(Field[x], this._wdg[i][0], 'value', Gio.SettingsBindFlags.DEFAULT);
            gset.bind(`${Field[x]}-night`, this._wdg[i][1], 'value', Gio.SettingsBindFlags.DEFAULT);
        });
    }

    _buildUI() {
        this._blk.PAPER.add_row(new Wallpaper(480, 270));
        [_('Style'), _('Gtk3'), _('Shell'), _('Icons'), _('Cursor')].forEach((x, i) => this._blk.NIGHT.add_row(new UI.PrefRow([x], ...this._wdg[i])));
        this.add(new UI.PrefRow(this._blk.STYLE, [_('Stylesheet'), _('Load from “~/.config/gnome-shell/gnome-shell{-light,-dark}.css”')]));
        ['NIGHT', 'PAPER'].forEach(x => { this.add(this._blk[x]); this._blk[x].enable_expansion && this._blk[x].set_expanded(true); });
    }
}

export default class PrefsWidget extends UI.Prefs { $klass = UserThemeXPrefs; }
