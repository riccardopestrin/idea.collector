-- proposals.task_url: link al task ClickUp su cui si lavora (mirror di git_ref,
-- 0020). Solo URL https di app.clickup.com: chi lo incolla è il proposer, chi
-- clicca sono gli altri membri, quindi niente host arbitrari. Cap 500.
alter table public.proposals
  add column task_url text
    check (task_url ~ '^https://app\.clickup\.com/' and length(task_url) <= 500);
