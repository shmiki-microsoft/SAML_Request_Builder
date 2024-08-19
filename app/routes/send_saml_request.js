const express = require('express');
const router = express.Router();
const saml2 = require('saml2-js');
const path = require('path');
const fs = require('fs');
const querystring = require('querystring');
const { decodeSamlRequest } = require('../utils/samlUtils');

function getSpOptions(req) {
    return {
        entity_id: req.body.issuer,
        assert_endpoint: req.body.assertionConsumerServiceURL || `${process.env.host}/acs`,
        nameid_format: req.body.nameIDFormat,
        force_authn: req.body.forceAuthn,
        private_key: fs.readFileSync(path.join(__dirname, `../keys/SP/${process.env.SP_PRIVATE_KEY_FILE}`)).toString(),
        certificate: fs.readFileSync(path.join(__dirname, `../keys/SP/${process.env.SP_CERT_FILE}`)).toString(),
        allow_unencrypted_assertion: true,
    };
}

function getIdpOptions(req) {
    return {
        sso_login_url: req.body.destination,
    };
}

router.get('/send_saml_request', (req, res) => {
    res.render('send_saml_request', {
        issuer:null,
        destination:null,
        assertionConsumerServiceURL:`${process.env.host}/acs`,
        nameIDFormat:null,
        forceAuthn:null,
        _isGenerate:null,
        _isRequest:null,
        samlRequest: null
    });
});

router.post('/send_saml_request', (req, res) => {
    const spOptions = getSpOptions(req);
    const idpOptions = getIdpOptions(req);

    const sp = new saml2.ServiceProvider(spOptions);
    const idp = new saml2.IdentityProvider(idpOptions);

    sp.create_login_request_url(idp, {}, async (err, login_url, request_id) => {
        if (err) {
            console.error({ err });
            return res.status(500).render('error', { message: err.message, error: err });
        }
        if(req.body._isGenerate === "true"){
            // const option = req.body;
            // const urlParts = new URL(login_url);
            // const samlRequest = querystring.parse(urlParts.search.slice(1)).SAMLRequest;
            // option.samlRequest = ecodeSamlRequest(samlRequest)
            // return res.render('send_saml_request',option)
            try {
                const urlParts = new URL(login_url);
                const samlRequestEncoded = querystring.parse(urlParts.search.slice(1)).SAMLRequest;
        
                if (!samlRequestEncoded) {
                    return res.status(400).render('error', { message: "SAMLRequest parameter is missing in the URL" });
                }
        
                const samlRequest = await decodeSamlRequest(samlRequestEncoded);
                const option = { ...req.body,samlRequest };
        
                return res.render('send_saml_request', option);
            } catch (err) {
                console.error(err);
                return res.status(500).render('error', { message: "Failed to process SAML Request", error: err });
            }
            //  decodeSamlRequest(samlRequest, (result) =>{
            //     option.samlRequest = result
            //     return res.render('send_saml_request',option)
            // })
        }else{
            return res.redirect(login_url);
        }

        
    });
});

module.exports = router;