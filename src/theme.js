// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';

import * as Util from './util.js';

const isDefault = x => x === '' || x === 'Adwaita'; // shell || others
const Gtk3 = ['Adwaita', 'HighContrast', 'HighContrastInverse'];

function getDataDirs(type) {
    return [
        `${GLib.get_home_dir()}/.${type}`,
        `${GLib.get_user_data_dir()}/${type}`,
        ...GLib.get_system_data_dirs().map(dir => `${dir}/${type}`),
    ];
}

const extant = x => !GLib.access(x, 0); // F_OK == 0
const getModeThemeDirs = () => GLib.get_system_data_dirs().map(dir => `${dir}/gnome-shell/theme`);
const getThemes = async x => (await Promise.all(getDataDirs(x).map(async d => await Util.readdir(d, y => [d, y.get_name()]).catch(Util.noop) ?? []))).flat();
const getModeThemes = async () => (await Promise.all(getModeThemeDirs().map(async d => await Util.readdir(d, x => x.get_name()).catch(Util.noop) ?? []))).flat()
    .flatMap(x => x.endsWith('.css') ? [x.slice(0, -4)] : []);

export const getShellThemePath = theme => getDataDirs('themes').map(x => `${x}/${theme}/gnome-shell/gnome-shell.css`)
           .concat(getModeThemeDirs().map(x => `${x}/${theme}.css`)).find(x => extant(x));
export async function getAllThemes() {
    let modes = await getModeThemes(),
        icons = await getThemes('icons'),
        themes = await getThemes('themes');
    return [
        // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
        themes.map(([x, y]) => extant(`${x}/${y}/gtk-3.0/gtk.css`) ? [y] : []).concat(Gtk3),
        themes.map(([x, y]) => extant(`${x}/${y}/gnome-shell/gnome-shell.css`) ? [y] : []).concat(modes, ''),
        icons.map(([x, y]) => extant(`${x}/${y}/index.theme`) ? [y] : []),
        icons.map(([x, y]) => extant(`${x}/${y}/cursors`) ? [y] : []),
    ].map(x => [...new Set(x.flat())].filter(y => y.toLowerCase() !== 'default' || isDefault(y))
          .sort((a, b) => isDefault(b) - isDefault(a) || a.localeCompare(b))); // => [gtk, shell, icon, cursor]
}
