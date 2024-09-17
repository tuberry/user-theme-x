// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';
import * as Gettext from 'gettext';

import * as UI from './ui.js';
import * as Util from './util.js';
import * as Theme from './theme.js';
import {Field, DARK, LIGHT} from './const.js';

const {_} = UI;
const _ADW = Gettext.domain('libadwaita').gettext;

Gio._promisify(Adw.AlertDialog.prototype, 'choose');

const Color = {
    blue:   '#3584e4', teal:   '#2190a4', green: '#3a944a',
    yellow: '#c88800', orange: '#ed5b00', red:   '#e62d42',
    pink:   '#d56199', purple: '#9141ac', slate: '#6f8396',
}; // from https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/src/st/st-theme-context.c
const Icon = {LIGHT: 'weather-clear-symbolic', DARK: 'weather-clear-night-symbolic'};
const Style = {default: 'No Preference', 'prefer-dark': 'Prefer Dark', 'prefer-light': 'Prefer Light'}; // from https://gitlab.gnome.org/GNOME/libadwaita/-/blob/main/src/adw-inspector-page.c

class ThemeLabel extends UI.IconLabel {
    static {
        GObject.registerClass(this);
    }

    constructor(color, icon) {
        super(icon ?? 'object-select-symbolic', !icon, {useMarkup: true});
        if(color) this.insert_child_after(this.$color = new Gtk.Image(), icon ? this.$icon : null);
    }

    setup(dft, str, tran) {
        super.setup(null, dft ? `${tran(str)} <i>(${UI._GTK('Default')})</i>` : tran(str)); // ? snapshot.append_fill
        this.$color?.set_from_gicon(Gio.BytesIcon.new(Util.encode(`<svg fill="${Color[str]}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32"/></svg>`)));
    }
}

class Stylesheet extends UI.File {
    static {
        GObject.registerClass(this);
    }

    constructor(icon, tooltipText) {
        super({filter: {mimeTypes: ['text/css']}}, {tooltipText}, icon);
    }

    setup(value, icon, text) {
        super.setup(value, null, text);
    }
}

class ThemeDrop extends Gtk.DropDown {
    static {
        GObject.registerClass(UI.val('string', ''), this);
    }

    constructor(data, icon, tooltipText) {
        let color = data === Color;
        let [strv, tran] = Array.isArray(data) ? [data, x => Util.upcase(x, Util.id)]
            : [Object.keys(data), color ? x => _ADW(Util.upcase(x)) : x => _ADW(data[x])];
        super({model: Gtk.StringList.new(strv), valign: Gtk.Align.CENTER, tooltipText});
        if(strv.length > 9) this.#enableSearch();
        let bindTheme = (x, y) => x.setup(this.model.get_item(0) === y, y.string, tran);
        this.set_list_factory(Util.hook({
            setup: (_f, x) => x.set_child(new ThemeLabel(color)),
            bind: (_f, {child, item}) => {
                bindTheme(child, item);
                UI.Broker.tie(this, 'selected-item', child.$icon, 'visible', (_b, v) => [true, v === item]);
            },
            unbind: (_f, {child}) => UI.Broker.untie(this, child.$icon), // ISSUE: https://gitlab.gnome.org/GNOME/gjs/-/issues/614
        }, new Gtk.SignalListItemFactory()));
        this.set_factory(Util.hook({
            setup: (_f, x) => x.set_child(new ThemeLabel(color, icon)),
            bind: (_f, {child, item}) => bindTheme(child, item),
        }, new Gtk.SignalListItemFactory()));
        this.bind_property_full('value', this, 'selected', Util.BIND, (_b, v) => {
            let ret = this.model.get_n_items();
            do ret--; while(ret > -1 && v !== this.model.get_item(ret).string);
            return [ret !== -1, ret];
        }, (_b, v) => [v !== Gtk.INVALID_LIST_POSITION, this.model.get_item(v)?.string ?? '']);
    }

    #enableSearch() {
        this.set_enable_search(true);
        this.set_search_match_mode(Gtk.StringFilterMatchMode.SUBSTRING);
        this.set_expression(new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'));
    }
}

class Wallpaper extends Adw.PreferencesRow {
    static {
        GObject.registerClass({
            Properties: UI.trait({
                dark:  ['string', ''],
                light: ['string', ''],
            }),
        }, this);
    }

    constructor(widthRequest = 480, heightRequest = 270) {
        super();
        let area = new Gtk.DrawingArea({widthRequest, heightRequest}),
            gset = new Gio.Settings({schema: 'org.gnome.desktop.background'}),
            [light, dark] = [['light', Icon.LIGHT, 'picture-uri', _('Day')], ['dark', Icon.DARK, 'picture-uri-dark', _('Night')]]
                .map(([prop, iconName, key, tooltipText]) => {
                    gset.bind(key, this, prop, Gio.SettingsBindFlags.DEFAULT);
                    this.connect(`notify::${prop}`, () => area.queue_draw());
                    return Util.hook({
                        clicked: () => this.#onClick(prop).then(x => { this[prop] = `file://${x.get_path()}`; }).catch(Util.noop),
                    }, new Gtk.Button({
                        cssClasses: ['suggested-action'], heightRequest, tooltipText,
                        child: new Gtk.Image({iconName, iconSize: Gtk.IconSize.LARGE}),
                    }));
                });
        this.$reset = () => ['picture-uri', 'picture-uri-dark'].forEach(x => gset.reset(x));
        area.set_draw_func((...xs) => this.#draw(...xs));
        this.set_child(new UI.Box([light, area, dark]));
    }

    get dlg() {
        return (this.$dialog ??= Util.seq(x => x.defaultFilter.add_pixbuf_formats(),
            new Gtk.FileDialog({modal: true, defaultFilter: new Gtk.FileFilter()})));
    }

    #onClick(prop) {
        this.dlg.set_title(prop === 'light' ? _('Day') : _('Night'));
        return this.dlg.open(this.get_root(), null);
    }

    #draw(_a, cr, w, h) {
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

class UserThemeXPrefs extends UI.PrefsPage {
    static {
        GObject.registerClass(this);
    }

    constructor(gset) {
        super(null, new Adw.PreferencesGroup({title: _('Theme'), description: _('Switch according to the Night Light status')}));
        this.#buildWidgets(gset).then(() => this.#buildUI());
    }

    async #buildWidgets(gset) {
        let resets = [],
            [gtk, shell, icon, cursor] = await Theme.getAllThemes(),
            variant = [[Icon.LIGHT, _('Day')], [Icon.DARK, _('Night')]];
        [
            ['SHEET',  [_('_Stylesheet')], Stylesheet],
            ['STYLE',  [_('S_tyle')], Style],
            ['ICON',   [_('_Icon')], icon],
            ['CURSOR', [_('_Cursor')], cursor],
            ['GTK',    [_('_Legacy app')], gtk],
            ['SHELL',  [_('S_hell'), _('Never use with <a href="https://extensions.gnome.org/extension/19/user-themes/">user-theme</a> enabled')], shell],
            ['COLOR',  [_('_Accent color')], Color],
        ].forEach(([key, title, theme]) => {
            let widget = [new UI.Check(), title, ...variant.map(x => theme instanceof Function ? new theme(...x) : new ThemeDrop(theme, ...x))];
            ['', null, LIGHT, DARK].flatMap((x, i) => Util.str(x) && gset.bind(Util.seq(y => resets.unshift(y),
                `${Field[key]}${x}`), widget[i], 'value', Gio.SettingsBindFlags.DEFAULT));
            this.addToGroup(new UI.ActRow(...widget));
        });
        this.$prefs.set_header_suffix(this.#buildReset(() => resets.forEach(k => gset.reset(k)), this.$prefs.title));
    }

    #buildUI() {
        let title = _('Wallpaper'),
            paper = new Wallpaper(),
            reset = this.#buildReset(() => paper.$reset(), title);
        this.add(Util.seq(w => w.add(paper), new Adw.PreferencesGroup({title, description: _('Switch according to the system Light/Dark style'), headerSuffix: reset})));
    }

    #buildReset(callback, group) {
        return Util.hook({clicked: () => this.#confirm(callback, _('Reset all “%s” settings to default?').format(group))},
            new Gtk.Button({iconName: 'view-refresh-symbolic', tooltipText: UI._GTK('Reset'), hasFrame: false}));
    }

    async #confirm(callback, heading) {
        let dlg = new Adw.AlertDialog({heading});
        dlg.add_response('cancel', UI._GTK('_Cancel'));
        dlg.add_response('ensure', UI._GTK('_OK'));
        dlg.set_response_appearance('ensure', Adw.ResponseAppearance.DESTRUCTIVE);
        if(await dlg.choose(this, null) === 'ensure') callback();
    }
}

export default class Prefs extends UI.Prefs { $klass = UserThemeXPrefs; }
