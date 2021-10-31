// vim:fdm=syntax
// by tuberry
/* exported getThemeDirs getModeThemeDirs getGtkThemes
 * getShellThemes getIconThemes getCursorThemes*/
'use strict';

const { Gio, GLib, Gtk } = imports.gi;

const fn = (...args) => GLib.build_filenamev(args);

function getDirs(type) {
    return [
        fn(GLib.get_home_dir(), `.${type}`),
        fn(GLib.get_user_data_dir(), type),
        ...GLib.get_system_data_dirs().map(dir => fn(dir, type)),
    ];
}

function getThemeDirs() {
    return getDirs('themes');
}

function getModeThemeDirs() {
    return GLib.get_system_data_dirs().map(dir => fn(dir, 'gnome-shell', 'theme'));
}

function getThemes(type) {
    return getDirs(type).flatMap(path => {
        let dir = Gio.File.new_for_path(path), denum, info, themes = [];
        try {
            denum = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        } catch(e) {
            return [];
        }
        while((info = denum.next_file(null))) (fl => { themes.push({ name: fl.get_basename(), path: fl.get_path() }); })(denum.get_child(info));
        return themes;
    });
}

function getModeThemes() {
    return getModeThemeDirs().flatMap(path => {
        let dir = Gio.File.new_for_path(path), denum, info, themes = [];
        try {
            denum = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        } catch(e) {
            return [];
        }
        while((info = denum.next_file(null))) (fb => { if(fb.endsWith('.css')) themes.push(fb.slice(0, -4)); })(denum.get_child(info).get_basename());
        return themes;
    });
}

function getGtkThemes() {
    // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
    let themes = getThemes('themes').flatMap(theme => [0, Gtk.MINOR_VERSION].some(gtkv => {
        if(gtkv % 2) gtkv += 1;
        let css = Gio.File.new_for_path(fn(theme.path, `gtk-3.${gtkv}`, 'gtk.css'));
        return css.query_exists(null);
    }) ? [theme.name] : []
    );

    return [...new Set(themes)].sort();
}

function getShellThemes() {
    let themes = getThemes('themes').flatMap(theme => {
        let file = Gio.File.new_for_path(fn(theme.path, 'gnome-shell', 'gnome-shell.css'));
        return file.query_exists(null) ? [theme.name] : [];
    });

    return [...new Set(themes.concat(getModeThemes(), 'Default'))].sort();
}

function getIconThemes() {
    let themes = getThemes('icons').flatMap(theme => {
        let file = Gio.File.new_for_path(fn(theme.path, 'icon-theme.cache'));
        return file.query_exists(null) ? [theme.name] : [];
    });

    return [...new Set(themes)].sort();
}

function getCursorThemes() {
    let themes = getThemes('icons').flatMap(theme => {
        let file = Gio.File.new_for_path(fn(theme.path, 'cursors'));
        return file.query_exists(null) ? [theme.name] : [];
    });

    return [...new Set(themes)].sort();
}
