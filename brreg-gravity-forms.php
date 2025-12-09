<?php
/**
 * Plugin Name: Brønnøysund + Gravity Forms Autocomplete
 * Description: Autocomplete company info from Brønnøysund by using CSS classes on Gravity Forms fields.
 * Author: SimplyLearn / Nettsmeds
 * Version: 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Brreg_GravityForms_Autocomplete {

    const OPTION_NAME = 'brreg_gf_autocomplete_settings';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_styles' ) );
        register_activation_hook( __FILE__, array( __CLASS__, 'activate' ) );
    }

    /**
     * Default config for mappings.
     * Now reads from wp_options, with fallback to defaults.
     */
    public static function get_config() {
        $defaults = self::get_default_config();
        $saved = get_option( self::OPTION_NAME, array() );

        // Merge saved settings with defaults
        $config = array(
            'profiles' => array(
                array(
                    'id'                    => 'default',
                    'trigger_class'         => isset( $saved['trigger_class'] ) ? $saved['trigger_class'] : $defaults['trigger_class'],
                    'min_chars'             => isset( $saved['min_chars'] ) ? intval( $saved['min_chars'] ) : $defaults['min_chars'],
                    'outputs'               => array(
                        'orgnr'  => isset( $saved['outputs']['orgnr'] ) ? $saved['outputs']['orgnr'] : $defaults['outputs']['orgnr'],
                        'street' => isset( $saved['outputs']['street'] ) ? $saved['outputs']['street'] : $defaults['outputs']['street'],
                        'zip'    => isset( $saved['outputs']['zip'] ) ? $saved['outputs']['zip'] : $defaults['outputs']['zip'],
                        'city'   => isset( $saved['outputs']['city'] ) ? $saved['outputs']['city'] : $defaults['outputs']['city'],
                    ),
                    'make_fields_uneditable' => isset( $saved['make_fields_uneditable'] ) ? (bool) $saved['make_fields_uneditable'] : $defaults['make_fields_uneditable'],
                    'conditions'            => array(),
                ),
            ),
        );

        /**
         * Filter so we can override config from theme/other plugin.
         */
        return apply_filters( 'brreg_gf_autocomplete_config', $config );
    }

    /**
     * Get default configuration values.
     */
    private static function get_default_config() {
        return array(
            'trigger_class'         => 'bedrift',
            'min_chars'             => 2,
            'outputs'               => array(
                'orgnr'  => 'org_nummer',
                'street' => 'invoice_street',
                'zip'    => 'invoice_zip',
                'city'   => 'invoice_city',
            ),
            'make_fields_uneditable' => false,
        );
    }

    /**
     * Set default options on plugin activation.
     */
    public static function activate() {
        $defaults = self::get_default_config();
        $current = get_option( self::OPTION_NAME, array() );

        // Only set defaults if no settings exist
        if ( empty( $current ) ) {
            update_option( self::OPTION_NAME, $defaults );
        }
    }

    /**
     * Add admin menu page.
     */
    public function add_admin_menu() {
        add_options_page(
            'Brønnøysund + Gravity Forms',
            'Brreg GF Autocomplete',
            'manage_options',
            'brreg-gf-autocomplete',
            array( $this, 'render_settings_page' )
        );
    }

    /**
     * Register settings.
     */
    public function register_settings() {
        register_setting(
            'brreg_gf_autocomplete_settings_group',
            self::OPTION_NAME,
            array( $this, 'sanitize_settings' )
        );
    }

    /**
     * Sanitize settings before saving.
     */
    public function sanitize_settings( $input ) {
        $sanitized = array();

        if ( isset( $input['trigger_class'] ) ) {
            $sanitized['trigger_class'] = sanitize_html_class( $input['trigger_class'] );
        }

        if ( isset( $input['min_chars'] ) ) {
            $sanitized['min_chars'] = absint( $input['min_chars'] );
        }

        if ( isset( $input['outputs'] ) && is_array( $input['outputs'] ) ) {
            $sanitized['outputs'] = array();
            foreach ( $input['outputs'] as $key => $value ) {
                $sanitized['outputs'][ $key ] = sanitize_html_class( $value );
            }
        }

        $sanitized['make_fields_uneditable'] = isset( $input['make_fields_uneditable'] ) ? 1 : 0;

        return $sanitized;
    }

    /**
     * Enqueue admin styles.
     */
    public function enqueue_admin_styles( $hook ) {
        if ( 'settings_page_brreg-gf-autocomplete' !== $hook ) {
            return;
        }

        wp_enqueue_style(
            'brreg-gf-admin',
            plugin_dir_url( __FILE__ ) . 'assets/css/admin.css',
            array(),
            '0.1.0'
        );
    }

    /**
     * Render settings page.
     */
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $settings = get_option( self::OPTION_NAME, self::get_default_config() );
        ?>
        <div class="wrap brreg-gf-autocomplete-settings">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields( 'brreg_gf_autocomplete_settings_group' );
                ?>
                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row">
                                <label for="trigger_class"><?php esc_html_e( 'Company Name Field CSS Class', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <input 
                                    type="text" 
                                    id="trigger_class" 
                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[trigger_class]" 
                                    value="<?php echo esc_attr( $settings['trigger_class'] ); ?>" 
                                    class="regular-text"
                                    placeholder="bedrift"
                                />
                                <p class="description">
                                    <?php esc_html_e( 'The CSS class name applied to the Gravity Forms field wrapper for the company name input field.', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label><?php esc_html_e( 'Output Field CSS Classes', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <fieldset>
                                    <p>
                                        <label for="output_orgnr">
                                            <?php esc_html_e( 'Organization Number:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_orgnr" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][orgnr]" 
                                                value="<?php echo esc_attr( $settings['outputs']['orgnr'] ); ?>" 
                                                class="regular-text"
                                                placeholder="org_nummer"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_street">
                                            <?php esc_html_e( 'Street Address:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_street" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][street]" 
                                                value="<?php echo esc_attr( $settings['outputs']['street'] ); ?>" 
                                                class="regular-text"
                                                placeholder="invoice_street"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_zip">
                                            <?php esc_html_e( 'Zip Code:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_zip" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][zip]" 
                                                value="<?php echo esc_attr( $settings['outputs']['zip'] ); ?>" 
                                                class="regular-text"
                                                placeholder="invoice_zip"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_city">
                                            <?php esc_html_e( 'City:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_city" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][city]" 
                                                value="<?php echo esc_attr( $settings['outputs']['city'] ); ?>" 
                                                class="regular-text"
                                                placeholder="invoice_city"
                                            />
                                        </label>
                                    </p>
                                    <p class="description">
                                        <?php esc_html_e( 'CSS class names for the output fields that will be populated with company data.', 'brreg-gf-autocomplete' ); ?>
                                    </p>
                                </fieldset>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="min_chars"><?php esc_html_e( 'Minimum Characters', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <input 
                                    type="number" 
                                    id="min_chars" 
                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[min_chars]" 
                                    value="<?php echo esc_attr( $settings['min_chars'] ); ?>" 
                                    min="1"
                                    max="10"
                                    class="small-text"
                                />
                                <p class="description">
                                    <?php esc_html_e( 'Minimum number of characters before triggering the Brønnøysund API search.', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="make_fields_uneditable"><?php esc_html_e( 'Make Fields Uneditable', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <fieldset>
                                    <label for="make_fields_uneditable">
                                        <input 
                                            type="checkbox" 
                                            id="make_fields_uneditable" 
                                            name="<?php echo esc_attr( self::OPTION_NAME ); ?>[make_fields_uneditable]" 
                                            value="1"
                                            <?php checked( ! empty( $settings['make_fields_uneditable'] ) ); ?>
                                        />
                                        <?php esc_html_e( 'Make output fields uneditable (greyed out and locked from editing)', 'brreg-gf-autocomplete' ); ?>
                                    </label>
                                    <p class="description">
                                        <?php esc_html_e( 'When enabled, the output fields (organization number, street, zip, city) will be disabled and visually greyed out after being populated.', 'brreg-gf-autocomplete' ); ?>
                                    </p>
                                </fieldset>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function enqueue_scripts() {
        // Only load on frontend
        if ( is_admin() ) {
            return;
        }

        // Optional: only load on pages where Gravity Forms is rendered
        // If Gravity Forms not active, bail out
        if ( ! class_exists( 'GFForms' ) ) {
            return;
        }

        // You can add your own conditions here if you want to restrict further
        // e.g. only on arrangement CPT:
        // if ( ! is_singular( 'arrangement' ) ) return;

        $handle = 'brreg-gf-autocomplete';

        wp_enqueue_script(
            $handle,
            plugin_dir_url( __FILE__ ) . 'assets/js/brreg-gf-autocomplete.js',
            array(), // no dependencies
            '0.1.0',
            true
        );

        wp_localize_script(
            $handle,
            'BrregGFConfig',
            self::get_config()
        );
    }
}

new Brreg_GravityForms_Autocomplete();

