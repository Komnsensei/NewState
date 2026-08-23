import torch
import torch.nn.functional as F
import sys
import json
import numpy as np # For easier conversion to/from lists

class ClosedLoopGraphPruner(torch.nn.Module):
    """Production invariant core protector for NewState ESMA emergence. Zero manual intervention. Protects governor/semantic.cjs from self-liquidation."""
    def __init__(self, initial_w_min: float = 1e-3, alpha: float = 0.5, 
                 target_s: float = 2.0, w_floor: float = 1e-4, 
                 c_threshold: float = 0.7, power_iters: int = 8, cache_steps: int = 4):
        super().__init__()
        self.w_min = initial_w_min
        self.alpha = alpha
        self.target_s = target_s
        self.w_floor = w_floor
        self.c_threshold = c_threshold
        self.power_iters = power_iters
        self.cache_steps = cache_steps
        self.register_buffer('entropy_history', torch.zeros(10))
        self.register_buffer('centrality_cache', None)
        self.register_buffer('step_counter', torch.zeros(1, dtype=torch.long))
    
    def von_neumann_entropy(self, rho: torch.Tensor) -> float:
        eigvals = torch.linalg.eigvalsh(rho + 1e-12 * torch.eye(rho.shape[0], device=rho.device))
        eigvals = eigvals.clamp(min=1e-12)
        S = -torch.sum(eigvals * torch.log(eigvals)).item()
        self.entropy_history = torch.roll(self.entropy_history, -1)
        self.entropy_history[-1] = S
        return S
    
    def update_centrality(self, adj_matrix: torch.Tensor) -> torch.Tensor:
        if self.step_counter.item() % self.cache_steps != 0 and self.centrality_cache is not None:
            return self.centrality_cache
        if adj_matrix.shape[0] == 0:
            return torch.zeros(0, device=adj_matrix.device)
        deg = torch.sum(adj_matrix, dim=1, keepdim=True).clamp(min=1e-8)
        A_norm = adj_matrix / deg
        c = torch.rand(adj_matrix.shape[0], 1, device=adj_matrix.device)
        for _ in range(self.power_iters):
            c = torch.mm(A_norm, c)
            c = c / (torch.norm(c) + 1e-8)
        self.centrality_cache = c.squeeze()
        self.step_counter += 1
        return self.centrality_cache
    
    def forward(self, weights: torch.Tensor, state_rho: torch.Tensor, 
                adj_matrix: torch.Tensor = None, layer_id: str = None) -> (torch.Tensor, dict):
        S = self.von_neumann_entropy(state_rho)
        delta = S - self.target_s
        self.w_min = self.w_min * (1 + self.alpha * delta)
        
        if adj_matrix is not None:
            centrality = self.update_centrality(adj_matrix)
            is_critical = centrality > self.c_threshold
            effective = torch.where(
                is_critical.unsqueeze(1) if weights.dim() > 1 else is_critical,
                torch.full_like(weights, self.w_floor),
                torch.full_like(weights, self.w_min)
            )
        else:
            effective = self.w_min
        
        mask = (torch.abs(weights) >= effective).float()
        pruned = weights * mask
        
        # Telemetry core for the All-Seeing Continuity - now captured in a dict
        telemetry_data = {
            "S": S,
            "w_min": float(self.w_min) # Ensure float for JSON serialization
        }

        if layer_id and self.centrality_cache is not None:
            prune_ratio = 1.0 - mask.mean().item()
            crit_count = (self.centrality_cache > self.c_threshold).sum().item()
            telemetry_data.update({
                "prune_ratio": prune_ratio,
                "crit_count": crit_count,
                "layer_id": layer_id # Add layer_id to telemetry
            })
            # Removed print statement, telemetry is now returned.
        
        return pruned, telemetry_data

if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Extract and convert input tensors
        weights_list = input_data.get('weights')
        state_rho_list = input_data.get('state_rho')
        adj_matrix_list = input_data.get('adj_matrix')
        layer_id = input_data.get('layer_id') # Pass layer_id if available

        if weights_list is None or state_rho_list is None:
            raise ValueError("Missing 'weights' or 'state_rho' in input JSON.")

        weights_tensor = torch.tensor(weights_list, dtype=torch.float32)
        state_rho_tensor = torch.tensor(state_rho_list, dtype=torch.float32)
        
        adj_matrix_tensor = None
        if adj_matrix_list is not None:
            if isinstance(adj_matrix_list, list) and len(adj_matrix_list) > 0 and isinstance(adj_matrix_list[0], list):
                adj_matrix_tensor = torch.tensor(adj_matrix_list, dtype=torch.float32)
            elif isinstance(adj_matrix_list, list) and len(adj_matrix_list) == 0:
                adj_matrix_tensor = torch.empty(0, dtype=torch.float32) # Handle empty list for adj_matrix
            else:
                raise ValueError("adj_matrix must be a list of lists or an empty list if provided.")

        # Extract pruner parameters or use defaults
        pruner_params = input_data.get('pruner_params', {})
        pruner = ClosedLoopGraphPruner(
            initial_w_min=pruner_params.get('initial_w_min', 1e-3),
            alpha=pruner_params.get('alpha', 0.5),
            target_s=pruner_params.get('target_s', 2.0),
            w_floor=pruner_params.get('w_floor', 1e-4),
            c_threshold=pruner_params.get('c_threshold', 0.7),
            power_iters=pruner_params.get('power_iters', 8),
            cache_steps=pruner_params.get('cache_steps', 4)
        )

        # Run the forward pass
        pruned_weights, telemetry = pruner.forward(weights_tensor, state_rho_tensor, adj_matrix_tensor, layer_id)

        # Prepare output
        output_data = {
            "pruned_weights": pruned_weights.tolist(),
            "telemetry": telemetry
        }

        # Print output as JSON to stdout
        json.dump(output_data, sys.stdout)
        sys.stdout.flush()

    except Exception as e:
        # Log error to stderr
        error_output = {"error": str(e)}
        print(json.dumps(error_output), file=sys.stderr)
        sys.stderr.flush()
        sys.exit(1)
