import unittest

from install_codex_macos import (
    build_config_toml,
    get_node_pkg_url,
    resolve_shell_profile,
    update_shell_profile_contents,
    validate_api_key,
)


class InstallCodexMacosTests(unittest.TestCase):
    def test_validate_api_key_rejects_invalid_values(self):
        self.assertFalse(validate_api_key(""))
        self.assertFalse(validate_api_key("abc"))
        self.assertTrue(validate_api_key("sk-test-key"))
        self.assertTrue(
            validate_api_key(
                "2f57366b9c673670402fdbe3cf9506b0581fe224d7a6a6b5527b9f6702cfa58c"
            )
        )

    def test_build_config_toml_uses_environment_variable_reference(self):
        config = build_config_toml()

        self.assertIn('env_key = "OPENAI_API_KEY"', config)
        self.assertNotIn("sk-", config)

    def test_update_shell_profile_contents_is_idempotent(self):
        initial = "# existing\n"
        once = update_shell_profile_contents(initial, "sk-test-key")
        twice = update_shell_profile_contents(once, "sk-test-key")

        self.assertEqual(once, twice)
        self.assertEqual(twice.count("OPENAI_API_KEY"), 1)
        self.assertIn('export OPENAI_API_KEY="sk-test-key"', twice)

    def test_resolve_shell_profile_prefers_zsh_and_falls_back_to_bash(self):
        self.assertEqual(
            resolve_shell_profile("/bin/zsh", "/Users/demo"),
            "/Users/demo/.zshrc",
        )
        self.assertEqual(
            resolve_shell_profile("/bin/bash", "/Users/demo"),
            "/Users/demo/.bash_profile",
        )

    def test_get_node_pkg_url_returns_macos_package(self):
        url = get_node_pkg_url("24.0.0", "arm64")

        self.assertEqual(
            url,
            "https://nodejs.org/dist/v24.0.0/node-v24.0.0.pkg",
        )


if __name__ == "__main__":
    unittest.main()
