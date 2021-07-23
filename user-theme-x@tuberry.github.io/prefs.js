// vim:fdm=syntax
// by: tuberry@github
'use strict';

const { Gio, GObject, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;
const gsettings = ExtensionUtils.getSettings();
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
    return new UserTHemeXPrefs();
}

const UserTHemeXPrefs = GObject.registerClass(
class UserTHemeXPrefs extends Gtk.ScrolledWindow {
    _init() {
        super._init({ hscrollbar_policy: Gtk.PolicyType.NEVER, });

        this._buildWidgets();
        this._bindValues();
        this._buildUI();
    }

    _buildWidgets() {
        let cursor = Util.getCursorThemes();
        let icon   = Util.getIconThemes();
        let gtk    = Util.getGtkThemes();
        let shell  = Util.getShellThemes();
        this._field_cursor       = new UI.Drop(cursor, null, true);
        this._field_cursor_night = new UI.Drop(cursor, null, true);
        this._field_icons        = new UI.Drop(icon, null, true);
        this._field_icons_night  = new UI.Drop(icon, null, true);
        this._field_gtk          = new UI.Drop(gtk, null, true);
        this._field_gtk_night    = new UI.Drop(gtk, null, true);
        this._field_shell        = new UI.Drop(shell, null, true);
        this._field_shell_night  = new UI.Drop(shell, null, true);
        this._field_night        = new Gtk.CheckButton({ label: _('Themes') });
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

        this._field_night.connect("notify::active", widget => {
            this._field_gtk.set_sensitive(widget.active);
            this._field_icons.set_sensitive(widget.active);
            this._field_shell.set_sensitive(widget.active);
            this._field_cursor.set_sensitive(widget.active);
            this._field_gtk_night.set_sensitive(widget.active);
            this._field_icons_night.set_sensitive(widget.active);
            this._field_shell_night.set_sensitive(widget.active);
            this._field_cursor_night.set_sensitive(widget.active)
        });
        this._field_gtk.set_sensitive(this._field_night.active);
        this._field_icons.set_sensitive(this._field_night.active);
        this._field_shell.set_sensitive(this._field_night.active);
        this._field_cursor.set_sensitive(this._field_night.active);
        this._field_gtk_night.set_sensitive(this._field_night.active);
        this._field_icons_night.set_sensitive(this._field_night.active);
        this._field_shell_night.set_sensitive(this._field_night.active);
        this._field_cursor_night.set_sensitive(this._field_night.active);
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
        }
        return grid;
    }

    _labelMaker(x, y) {
        let label = new UI.Label(x);
        if(!y) label.set_hexpand(false);
        label.set_halign(y ? Gtk.Align.CENTER : Gtk.Align.END)
        return label;
    }
});

