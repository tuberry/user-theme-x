// vim:fdm=syntax
// by tuberry
/* exported init buildPrefsWidget */
'use strict';

const { Gio, GObject, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const gsettings = ExtensionUtils.getSettings();
const _ = ExtensionUtils.gettext;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const UI = Me.imports.ui;

var Fields = {
    GTK:         'gtk-x',
    ICONS:       'icons-x',
    NIGHT:       'night-x',
    SHELL:       'shell-x',
    CURSOR:      'cursor-x',
    GTKNIGHT:    'gtk-night-x',
    STYLE:       'stylesheet-x',
    ICONSNIGHT:  'icons-night-x',
    SHELLNIGHT:  'shell-night-x',
    CURSORNIGHT: 'cursor-night-x',
};

function init() {
    ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    return new UserThemeXPrefs();
}

var Drop = GObject.registerClass({
    GTypeName: 'Gjs_%s_UI_Drop'.format(Me.metadata.uuid),
    Properties: {
        'actives': GObject.ParamSpec.string('actives', 'actives', 'actives', GObject.ParamFlags.READWRITE, ''),
        'active':  GObject.ParamSpec.uint('active', 'active', 'active', GObject.ParamFlags.READWRITE, 0, 10000, 0),
    },
}, class Drop extends Gtk.Box {
    _init(opts, tip, hexpand, params) {
        super._init(params);
        this._opts = opts;
        this._drop = Gtk.DropDown.new_from_strings(opts);
        this._drop.connect('notify::selected', () => {
            this.notify('active');
            this.notify('actives');
        });
        // this._drop.set_enable_search(true);
        if(tip) this._drop.set_tooltip_text(tip);
        if(hexpand) this._drop.set_hexpand(true);
        this.append(this._drop);
    }

    set active(active) {
        this._drop.set_selected(active);
    }

    get active() {
        return this._drop.get_selected();
    }

    set actives(actives) {
        this._drop.set_selected(this._opts.indexOf(actives));
    }

    get actives() {
        return this._drop.get_selected_item().get_string();
    }
});

const UserThemeXPrefs = GObject.registerClass(
class UserThemeXPrefs extends Gtk.ScrolledWindow {
    _init() {
        super._init({ hscrollbar_policy: Gtk.PolicyType.NEVER });
        this._buildWidgets();
        this._bindValues();
        this._buildUI();
    }

    _buildWidgets() {
        let cursor = Util.getCursorThemes();
        let icon   = Util.getIconThemes();
        let gtk    = Util.getGtkThemes();
        let shell  = Util.getShellThemes();
        this._field_cursor       = new Drop(cursor, null, true);
        this._field_cursor_night = new Drop(cursor, null, true);
        this._field_icons        = new Drop(icon, null, true);
        this._field_icons_night  = new Drop(icon, null, true);
        this._field_gtk          = new Drop(gtk, null, true);
        this._field_gtk_night    = new Drop(gtk, null, true);
        this._field_shell        = new Drop(shell, null, true);
        this._field_shell_night  = new Drop(shell, null, true);
        this._field_night        = new Gtk.CheckButton({ label: _('Themes'), tooltip_text: _('Switch according to the Night Light in the Settings') });
        this._field_style        = new UI.Check(_('Load user stylesheet “~/.config/gnome-shell/gnome-shell{,-dark}.css”'));
    }

    _buildUI() {
        let grid = this._listGridMaker();
        grid._add(this._field_style);
        grid._add(this._field_night, this._labelMaker(_('Day'), true), this._labelMaker(_('Night'), true));
        grid._add(this._labelMaker(_('Gtk')),    this._field_gtk,    this._field_gtk_night);
        grid._add(this._labelMaker(_('Shell')),  this._field_shell,  this._field_shell_night);
        grid._add(this._labelMaker(_('Icons')),  this._field_icons,  this._field_icons_night);
        grid._add(this._labelMaker(_('Cursor')), this._field_cursor, this._field_cursor_night);
        this.set_child(new UI.Frame(grid));
    }

    _bindValues() {
        gsettings.bind(Fields.NIGHT,       this._field_night,        'active',  Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.STYLE,       this._field_style,        'active',  Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.CURSORNIGHT, this._field_cursor_night, 'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.CURSOR,      this._field_cursor,       'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.ICONSNIGHT,  this._field_icons_night,  'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.ICONS,       this._field_icons,        'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.SHELLNIGHT,  this._field_shell_night,  'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.SHELL,       this._field_shell,        'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.GTKNIGHT,    this._field_gtk_night,    'actives', Gio.SettingsBindFlags.DEFAULT);
        gsettings.bind(Fields.GTK,         this._field_gtk,          'actives', Gio.SettingsBindFlags.DEFAULT);
        [this._field_gtk, this._field_icons, this._field_shell, this._field_cursor,
            this._field_gtk_night, this._field_icons_night, this._field_shell_night, this._field_cursor_night].forEach(widget => {
            this._field_night.bind_property('active', widget, 'sensitive', GObject.BindingFlags.GET);
            widget.set_sensitive(this._field_night.active);
        });
    }

    _listGridMaker() {
        let grid = new UI.ListGrid();
        grid._add = (x, y, z) => {
            let c = grid._count;
            if(z) {
                grid.attach(x, 0, c, 1, 1);
                grid.attach(y, 1, c, 1, 1);
                grid.attach(z, 2, c, 1, 1);
            } else if(y) {
                grid.attach(x, 0, c, 2, 1);
                grid.attach(y, 2, c, 1, 1);
            } else {
                grid.attach(x, 0, c, 3, 1);
            }
            grid._count++;
        };

        return grid;
    }

    _labelMaker(x, y) {
        let label = new UI.Label(x);
        if(!y) label.set_hexpand(false);
        label.set_halign(y ? Gtk.Align.CENTER : Gtk.Align.END);

        return label;
    }
});

