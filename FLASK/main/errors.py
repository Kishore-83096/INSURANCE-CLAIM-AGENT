from flask import jsonify


def register_error_handlers(app):

    @app.errorhandler(ValueError)
    def handle_value_error(error):
        return jsonify({
            "error": str(error)
        }), 400

    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({
            "error": "Route not found."
        }), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        return jsonify({
            "error": "Internal server error."
        }), 500