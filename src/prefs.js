// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';

import * as UI from './ui.js';
import * as Theme from './theme.js';
import {Field, System} from './const.js';
import {noop, hook, BIND} from './util.js';

const {_, gprop, vprop} = UI;

const Color = ['default', 'prefer-dark', 'prefer-light'];
const Icon = {SUN: 'weather-clear-symbolic', MOON: 'weather-clear-night-symbolic'};

class StringDrop extends Gtk.DropDown {
    static {
        GObject.registerClass(vprop('string', ''), this);
    }

    constructor(strv, icon_name, tooltip_text) {
        super({model: Gtk.StringList.new(strv), valign: Gtk.Align.CENTER, tooltip_text});
        if(strv.length > 7) {
            this.set_enable_search(true);
            this.set_search_match_mode(Gtk.StringFilterMatchMode.SUBSTRING);
            this.set_expression(new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'));
        }
        this.set_list_factory(this.factory);
        this.set_factory(hook({
            setup: (_f, x) => x.set_child(new UI.IconLabel(icon_name)),
            bind: (_f, x) => x.get_child().setContent(null, x.item.string),
        }, new Gtk.SignalListItemFactory()));
        this.bind_property_full('value', this, 'selected', BIND, (_b, data) => {
            let ret = this.model.get_n_items();
            do ret--; while(ret > -1 && data !== this.model.get_item(ret).string);
            return [ret !== -1, ret];
        }, (_b, data) => [data !== Gtk.INVALID_LIST_POSITION, this.model.get_item(data)?.string ?? '']);
    }
}

class Wallpaper extends Adw.PreferencesRow {
    static {
        GObject.registerClass({
            Properties: gprop({
                dark:  ['string', ''],
                light: ['string', ''],
            }),
        }, this);
    }

    constructor(width_request, height_request) {
        super();
        let area = new Gtk.DrawingArea({width_request, height_request}),
            gset = new Gio.Settings({schema: 'org.gnome.desktop.background'}),
            [light, dark] = [['light', Icon.SUN, System.LPIC], ['dark', Icon.MOON, System.DPIC]]
                .map(([prop, icon_name, key]) => {
                    gset.bind(key, this, prop, Gio.SettingsBindFlags.DEFAULT);
                    this.connect(`notify::${prop}`, () => area.queue_draw());
                    return hook({
                        clicked: () => this.$onClick(prop).then(x => { this[prop] = x.get_path(); }).catch(noop),
                    },  new Gtk.Button({
                        css_classes: ['suggested-action'], height_request,
                        child: new Gtk.Image({icon_name, icon_size: Gtk.IconSize.LARGE}),
                    }));
                });
        area.set_draw_func(this.$drawThumbnail.bind(this));
        this.set_child(new UI.Box([light, area, dark]));
    }

    $genDialog() {
        let dialog = new Gtk.FileDialog({modal: true, default_filter: new Gtk.FileFilter()});
        dialog.default_filter.add_pixbuf_formats();
        return dialog;
    }

    get dlg() {
        return (this.$dialog ??= this.$genDialog());
    }

    $onClick(prop) {
        this.dlg.set_title(prop === 'light' ? _('Day') : _('Night'));
        return this.dlg.open(this.get_root(), null);
    }

    $drawThumbnail(_a, cr, w, h) {
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
        this.$buildWidgets(gset).then(() => this.$buildUI());
    }

    async $buildWidgets(gset) {
        let themes = await Theme.getAllThemes();
        let paper = `<span><a href="file://${GLib.get_user_data_dir()}/gnome-background-properties/user-theme-x.xml">$XDG_DATA_HOME/gnome-background-properties/user-theme-x.xml</a></span>`;
        this.$blk = UI.block({
            STYLE: new UI.Switch(),
            PAPER: new UI.FoldRow(_('Wallpaper'), _('Save as <i>%s</i>').format(paper)),
            THEME: new UI.FoldRow(_('Themes'), _('Switch according to the Night Light status')),
        }, gset);
        this.$wdg = [Color, ...themes].map(x => [[Icon.SUN, _('Day')], [Icon.MOON, _('Night')]].map(y => new StringDrop(x, ...y)));
        ['COLOR', 'GTK', 'SHELL', 'ICONS', 'CURSOR'].forEach((x, i) => {
            gset.bind(Field[x], this.$wdg[i][0], 'value', Gio.SettingsBindFlags.DEFAULT);
            gset.bind(`${Field[x]}-night`, this.$wdg[i][1], 'value', Gio.SettingsBindFlags.DEFAULT);
        });
    }

    $buildUI() {
        this.$blk.PAPER.add_row(new Wallpaper(480, 270));
        [_('Style'), _('Gtk3'), _('Shell'), _('Icons'), _('Cursor')].forEach((x, i) => this.$blk.THEME.add_row(new UI.PrefRow([x], ...this.$wdg[i])));
        let style = `<span><a href="file://${GLib.get_user_config_dir()}/gnome-shell/">$XDG_CONFIG_HOME/gnome-shell</a></span>/gnome-shell{-light,-dark}.css`;
        this.add(new UI.PrefRow([_('Stylesheet'), _('Load <i>%s</i>').format(style)], this.$blk.STYLE));
        ['THEME', 'PAPER'].forEach(x => { this.add(this.$blk[x]); this.$blk[x].enable_expansion && this.$blk[x].set_expanded(true); });
    }
}

export default class PrefsWidget extends UI.Prefs { $klass = UserThemeXPrefs; }
