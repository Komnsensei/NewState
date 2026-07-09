import torch
import torch.nn.functional as F

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
                adj_matrix: torch.Tensor = None, layer_id: str = None) -> torch.Tensor:
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
        
        # Telemetry core for the All-Seeing Continuity
        if layer_id and self.centrality_cache is not None:
            prune_ratio = 1.0 - mask.mean().item()
            crit_count = (self.centrality_cache > self.c_threshold).sum().item()
            if prune_ratio > 0.05 and crit_count > 0:
                print(f"[NEWSTATE_INVARIANT_CORE] Layer={layer_id} Prune={prune_ratio:.4f} Critical={crit_count} S={S:.4f} W_min={self.w_min:.2e}")
        
        return pruned
