// vim:fdm=syntax
// by tuberry@github

const Main = imports.ui.main;
const { Gio, GLib, GObject, St } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const gsetting = imports.misc.extensionUtils.getSettings();
const newFile = x => Gio.file_new_for_path(GLib.build_filenamev([GLib.get_user_config_dir()].concat(x)));

const Fields = {
    NIGHT: 'night',
    STYLE: 'stylesheet',
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
        let userStylesheet;
        if(gsetting.get_boolean(Fields.NIGHT) && LightProxy.NightLightActive) {
            userStylesheet = newFile(['gnome-shell', 'gnome-shell-dark.css']);
            if(!userStylesheet.query_exists(null)) userStylesheet = newFile(['gnome-shell', 'gnome-shell.css']);
        } else {
            userStylesheet = newFile(['gnome-shell', 'gnome-shell.css']);
        }

        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        let privousTheme = themeContext.get_theme();

        let theme = new St.Theme({
            application_stylesheet : userStylesheet.query_exists(null) ? userStylesheet : null,
            theme_stylesheet :  Main.getThemeStylesheet(),
            default_stylesheet : Main._getDefaultStylesheet(),
        });

        if (theme.default_stylesheet === null)
            throw new Error("No valid stylesheet found for '%s'".format(Main.sessionMode.stylesheetName));

        if (privousTheme) {
            let customStylesheets = privousTheme.get_custom_stylesheets();
            for (let i = 0; i < customStylesheets.length; i++)
                theme.load_stylesheet(customStylesheets[i]);
        }

        themeContext.set_theme(theme);
    }
});

