// vim:fdm=syntax
// by tuberry@github

const Main = imports.ui.main;
const { Gio, GLib, GObject, St } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const gsetting = imports.misc.extensionUtils.getSettings();
const newFile = x => Gio.file_new_for_path(GLib.build_filenamev([GLib.get_user_config_dir()].concat(x)));

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
        this._originalLoadTheme = Main.loadTheme;
        Main.loadTheme = () => this._loadTheme();
        this._fileMonitor = newFile(['gnome-shell']).monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._fileChangedId = this._fileMonitor.connect('changed', () => { this.emit('file-changed'); });
    }

    disable() {
        Main.loadTheme = this._originalLoadTheme;
        if(this._fileChangedId) this._fileMonitor.disconnect(this._fileChangedId), this._fileChangedId = 0;
        this._fileMonitor = null;
    }

    _loadTheme() {
        let themeContext = St.ThemeContext.get_for_stage(global.stage);

        let userStylesheet = null;
        if(gsetting.get_boolean(Fields.NIGHT) && LightProxy.NightLightActive) {
            userStylesheet = newFile(['gnome-shell', 'gnome-shell-dark.css']);
            if(!userStylesheet.query_exists(null)) userStylesheet = newFile(['gnome-shell', 'gnome-shell.css']);
        } else {
            userStylesheet = newFile(['gnome-shell', 'gnome-shell.css']);
        }

        let theme;
        if(userStylesheet.query_exists(null))
            theme = new St.Theme({
                application_stylesheet: userStylesheet,
                theme_stylesheet:  Main.getThemeStylesheet(),
                default_stylesheet: Main._getDefaultStylesheet(),
            });
        else
            theme = new St.Theme({
                theme_stylesheet:  Main.getThemeStylesheet(),
                default_stylesheet: Main._getDefaultStylesheet(),
            });


        if(theme.default_stylesheet === null)
            throw new Error("No valid stylesheet found for '%s'".format(Main.sessionMode.stylesheetName));

        let previousTheme = themeContext.get_theme();
        if(previousTheme)
            previousTheme.get_custom_stylesheets().forEach(x => { theme.load_stylesheet(x); });

        themeContext.set_theme(theme);
    }
});

