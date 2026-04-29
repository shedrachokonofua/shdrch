{
  description = "shdrch - static site + image generation cron";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          name = "shdrch";

          packages = with pkgs; [
            # Bun toolchain
            bun

            # Task runner
            go-task

            # Containers + k8s
            kubectl
            awscli2
            s5cmd

            # Utilities
            jq
            git
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            colima  # Linux VM + docker daemon for macOS
          ];

          shellHook = ''
            echo "🛠  shdrch dev shell"
            echo "   bun: $(bun --version)"
            echo "   task: $(task --version)"
            echo ""
          '' + pkgs.lib.optionalString pkgs.stdenv.isDarwin ''
            if ! colima status >/dev/null 2>&1; then
              echo "🐳 Starting colima (docker daemon for macOS)..."
              colima start --cpu 4 --memory 4
            fi
            export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
          '';
        };
      });
}
