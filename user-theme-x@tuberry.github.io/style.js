// vim:fdm=syntax
// by tuberry@github

const Main = imports.ui.main;
const { Gio, GLib, GObject, St } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const gsettings = imports.misc.extensionUtils.getSettings();
const newFile = x => Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir()].concat(x)));

const Fields = {
    NIGHT: 'night-x',
    STYLE: 'stylesheet-x',
}

var UserStylesheet = GObject.registerClass({
    Signals: {
        'file-changed': {},
    },
}, class UserStylesheet extends GObject.Object {
    _init() {
        super._init();
    }

    enable() {
        this._emitCount = 0;
        this._originalLoadTheme = Main.loadTheme;
        Main.loadTheme = this.loadTheme;
        this._fileMonitor = newFile(['gnome-shell']).monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._fileChangedId = this._fileMonitor.connect('changed', (file, other, type) => {
            if(++this._emitCount == 10) {
                this.emit('file-changed');
                this._emitCount = 0; // NOTE: ugly hack for 10 signals when saving file
            }
        });
    }

    disable() {
        Main.loadTheme = this._originalLoadTheme;
        if(this._fileChangedId) this._fileMonitor.disconnect(this._fileChangedId), this._fileChangedId = 0;
        this._fileMonitor = null;
    }

    loadTheme() {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        let newTheme = new St.Theme({
            application_stylesheet: Main.getThemeStylesheet(),
            default_stylesheet: Main._getDefaultStylesheet(),
        });

        let day = newFile(['gnome-shell', 'gnome-shell.css']);
        let night = newFile(['gnome-shell', 'gnome-shell-dark.css']);
        let isNight = gsettings.get_boolean(Fields.NIGHT) && LightProxy.NightLightActive;
        if(night.query_exists(null) && isNight) {
            newTheme.load_stylesheet(night);
        } else if(day.query_exists(null)) {
            newTheme.load_stylesheet(day);
        } else {
            global.log('Could not find user stylesheet "~/.config/gnome-shell/gnome-shell{,-dark}.css"');
        }

        if(newTheme.default_stylesheet === null)
            throw new Error("No valid stylesheet found for '%s'".format(Main.sessionMode.stylesheetName));

        let previousTheme = themeContext.get_theme();
        if(previousTheme)
            previousTheme.get_custom_stylesheets().forEach(x => { if(!x.equal(day) && !x.equal(night)) newTheme.load_stylesheet(x); });

        themeContext.set_theme(newTheme);
    }
});

