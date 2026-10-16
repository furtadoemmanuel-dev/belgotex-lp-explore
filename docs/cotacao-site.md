# "Solicitar cotação": como a LP leva à cotação do Explore no site

A LP não tem formulário de cotação (igual à LP do Timberland v02). Todos os botões "Solicitar cotação" levam a:

`https://www.belgotex.com.br/produtos/comercial-em-placas/explore?utm_source=lp-explore&utm_medium=landing-page&utm_campaign=lp-explore&utm_content=<botão>#cotacao`

O site já abre o modal de cotação quando o endereço termina em `#cotacao` (função `openQuoteModalFromHash`).
**Mas, aberto assim, o modal vem vazio**: o Explore só entra já selecionado quando a pessoa clica no botão
"Cotação" da própria página (`.popup-with-form[data-product-id="112"]`, que chama `addProductToQuote`).

## Ajuste sugerido no site (para o desenvolvedor da Belgotex)

É o mesmo ajuste descrito para o Timberland (`belgotex-lp-timberland-spc/docs/cotacao-site.md`): em
`openQuoteModalFromHash`, se a página tiver o botão de cotação de um produto, clicar nele em vez de abrir o modal
genérico. Feito uma vez, vale para as duas LPs:

```js
function openQuoteModalFromHash() {
  if (!['#quoteModal', '#orcamento', '#cotacao'].includes(window.location.hash)) {
    return;
  }

  // Na página de um produto: abre a cotação já com o produto (mesmo caminho do botão "Cotação")
  const productButton = document.querySelector('.popup-with-form[data-product-id]');

  const open = () => {
    if (!window.$?.magnificPopup) {
      return false;
    }
    if (productButton) {
      productButton.click();
    } else {
      window.$.magnificPopup.open({ items: { src: '#quoteModal' }, type: 'inline' });
    }
    return true;
  };

  // ... o restante da função (tentativas a cada 150 ms) continua igual
}
```

## O que se perde em relação ao formulário antigo da LP

O compositor ("Cotar esta composição") não consegue mais levar as cores escolhidas para a cotação, porque o
formulário é do site. As cores continuam indo para o pedido de amostra e para a mensagem do WhatsApp.
