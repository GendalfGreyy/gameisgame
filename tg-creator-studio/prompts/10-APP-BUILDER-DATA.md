# 10 — Визуальный App Builder с реальным CRUD (G9)

Сделай App Studio по document-driven React renderer: PageTree + ComponentTree + Canvas + Inspector, мобильный fullscreen preview + component picker + bottom sheets. Allowlist компонентов Text, Button, Image, Input, Form, Card, Stack/Grid, List, Tabs, Modal, Toast, Navigation, DataTable. Styles/bindings сохраняются через `ProjectDocument`, адаптивные constraints задаются JSON.

Добавь Action Graph: OnClick→Navigate/SetState/SubmitForm/Data.Query/Data.Create/Data.Update/ShowToast. Data Collection schema и records храни серверно отдельно от design snapshot; ownership and row-level policies `publicRead`, `authenticatedOwnRows`, `ownerOnly` обязательны на сервере. Нельзя исполнять JSX или JavaScript автора, а внешние connectors пока не включать без безопасного capability proxy.

ACCEPTANCE: создать приложение Catalog + Orders, связать товары с коллекцией, создать форму заказа, Publish, один игрок создаёт заявку, другой не может увидеть/изменить чужую, UI корректно отображается в Telegram Android и Desktop. Integration и security tests CRUD/ACL/XSS.
